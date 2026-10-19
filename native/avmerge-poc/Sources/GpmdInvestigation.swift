import AVFoundation
import CoreMedia
import Foundation

enum GpmdInvestigation {
    struct TrackReport: Codable {
        let source: String
        let index: Int
        let trackID: Int32
        let mediaTypeRaw: String
        let mediaTypeCommon: String?
        let languageCode: String?
        let estimatedDataRate: Float
        let naturalSize: CGSizeCodable
        let formatDescriptions: [FormatDescReport]
        let readerPassthroughOK: Bool
        let readerSampleCount: Int?
        let readerFirstSampleBytes: Int?
        let readerError: String?
    }

    struct FormatDescReport: Codable {
        let mediaTypeFourCC: String
        let mediaSubTypeFourCC: String
        let extensionsSummary: String
    }

    struct CGSizeCodable: Codable {
        let width: Double
        let height: Double
    }

    struct AssetReport: Codable {
        let path: String
        let preferPreciseDuration: Bool
        let durationSeconds: Double
        let metadataItems: [MetadataItemReport]
        let allTracks: [TrackReport]
        let tracksByMediaTypeQuery: [MediaTypeQueryResult]
        let readerUnlistedSampleScan: ReaderScanReport?
    }

    struct MetadataItemReport: Codable {
        let identifier: String?
        let key: String?
        let keySpace: String?
        let value: String?
        let dataType: String?
    }

    struct MediaTypeQueryResult: Codable {
        let mediaTypeRaw: String
        let count: Int
        let trackIDs: [Int32]
    }

    struct ReaderScanReport: Codable {
        let note: String
        let gpmdLikeSamplesFound: Int
        let details: [String]
    }

    static func investigate(url: URL, preferPreciseDuration: Bool) async throws -> AssetReport {
        let options: [String: Any] = [
            AVURLAssetPreferPreciseDurationAndTimingKey: preferPreciseDuration,
        ]
        let asset = AVURLAsset(url: url, options: options)

        let duration = try await asset.load(.duration)
        let allTracks = try await asset.load(.tracks)
        let metadata = try await asset.load(.metadata)

        var metadataItems: [MetadataItemReport] = []
        for item in metadata {
            let loadedValue = try await item.load(.value)
            metadataItems.append(
                MetadataItemReport(
                    identifier: item.identifier?.rawValue,
                    key: item.key as? String,
                    keySpace: item.keySpace?.rawValue,
                    value: stringFromMetadataValue(loadedValue),
                    dataType: item.dataType
                )
            )
        }

        var trackReports: [TrackReport] = []
        for (idx, track) in allTracks.enumerated() {
            trackReports.append(try await inspectTrack(asset: asset, track: track, index: idx, source: "load(.tracks)"))
        }

        let mediaTypesToQuery: [AVMediaType] = [
            .video, .audio, .text, .closedCaption, .subtitle,
            .timecode, .metadata, .muxed,
        ]
        var queryResults: [MediaTypeQueryResult] = []
        for mt in mediaTypesToQuery {
            let matched = try await asset.loadTracks(withMediaType: mt)
            queryResults.append(
                MediaTypeQueryResult(
                    mediaTypeRaw: mt.rawValue,
                    count: matched.count,
                    trackIDs: matched.map(\.trackID)
                )
            )
        }

        // Also query raw four-char types GoPro uses (meta, gpmd not exposed as AVMediaType)
        let readerScan = try await scanAssetReaderForHiddenData(asset: asset, knownTrackIDs: Set(allTracks.map(\.trackID)))

        return AssetReport(
            path: url.path,
            preferPreciseDuration: preferPreciseDuration,
            durationSeconds: duration.seconds,
            metadataItems: metadataItems,
            allTracks: trackReports,
            tracksByMediaTypeQuery: queryResults,
            readerUnlistedSampleScan: readerScan
        )
    }

    static func inspectTrack(asset: AVAsset, track: AVAssetTrack, index: Int, source: String) async throws -> TrackReport {
        let fds = try await track.load(.formatDescriptions)
        let lang = try await track.load(.languageCode)
        let rate = try await track.load(.estimatedDataRate)
        let size = try await track.load(.naturalSize)

        var readerOK = false
        var sampleCount: Int?
        var firstBytes: Int?
        var readerError: String?

        do {
            let (count, bytes) = try await countPassthroughSamples(track: track, asset: asset)
            readerOK = true
            sampleCount = count
            firstBytes = bytes
        } catch {
            readerError = error.localizedDescription
        }

        return TrackReport(
            source: source,
            index: index,
            trackID: track.trackID,
            mediaTypeRaw: track.mediaType.rawValue,
            mediaTypeCommon: commonMediaTypeName(track.mediaType),
            languageCode: lang,
            estimatedDataRate: rate,
            naturalSize: CGSizeCodable(width: size.width, height: size.height),
            formatDescriptions: fds.map { describeFormat($0) },
            readerPassthroughOK: readerOK,
            readerSampleCount: sampleCount,
            readerFirstSampleBytes: firstBytes,
            readerError: readerError
        )
    }

    static func countPassthroughSamples(track: AVAssetTrack, asset: AVAsset) async throws -> (Int, Int) {
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: nil)
        output.alwaysCopiesSampleData = false
        guard reader.canAdd(output) else {
            throw NSError(domain: "gpmd", code: 2, userInfo: [NSLocalizedDescriptionKey: "cannot add reader output"])
        }
        reader.add(output)
        guard reader.startReading() else {
            throw reader.error ?? NSError(domain: "gpmd", code: 3, userInfo: nil)
        }

        var count = 0
        var firstSize = 0
        while reader.status == AVAssetReader.Status.reading {
            guard let sample = output.copyNextSampleBuffer() else { break }
            if count == 0, let block = CMSampleBufferGetDataBuffer(sample) {
                firstSize = CMBlockBufferGetDataLength(block)
            }
            count += 1
        }
        if reader.status == AVAssetReader.Status.failed {
            throw reader.error ?? NSError(domain: "gpmd", code: 4, userInfo: nil)
        }
        return (count, firstSize)
    }

    /// Attempt reader on every track; flag if any track has samples but isn't gpmd-visible in format.
    static func scanAssetReaderForHiddenData(asset: AVAsset, knownTrackIDs: Set<Int32>) async throws -> ReaderScanReport {
        let tracks = try await asset.load(.tracks)
        var details: [String] = []
        var gpmdLike = 0

        for track in tracks {
            let fds = try await track.load(.formatDescriptions)
            let subtypes = fds.map { fourCCString(CMFormatDescriptionGetMediaSubType($0)) }
            let hasGpmdSubtype = subtypes.contains(where: { $0 == "gpmd" })
            if hasGpmdSubtype { gpmdLike += 1 }

            let (count, firstBytes) = try await countPassthroughSamples(track: track, asset: asset)
            details.append(
                "trackID=\(track.trackID) type=\(track.mediaType.rawValue) subtypes=[\(subtypes.joined(separator: ","))] samples=\(count) firstBytes=\(firstBytes)"
            )
        }

        return ReaderScanReport(
            note: "AVAssetReader only sees \(tracks.count) AVAssetTrack(s); gpmd is not among them on GoPro MP4.",
            gpmdLikeSamplesFound: gpmdLike,
            details: details
        )
    }

    static func describeFormat(_ desc: CMFormatDescription) -> FormatDescReport {
        let mt = CMFormatDescriptionGetMediaType(desc)
        let st = CMFormatDescriptionGetMediaSubType(desc)
        var extSummary = ""
        if let ext = CMFormatDescriptionGetExtensions(desc) as? [String: Any] {
            extSummary = ext.keys.sorted().prefix(8).joined(separator: ",")
        }
        return FormatDescReport(
            mediaTypeFourCC: fourCCString(mt),
            mediaSubTypeFourCC: fourCCString(st),
            extensionsSummary: extSummary
        )
    }

    static func commonMediaTypeName(_ type: AVMediaType) -> String? {
        switch type {
        case .video: return "video"
        case .audio: return "audio"
        case .text: return "text"
        case .closedCaption: return "closedCaption"
        case .subtitle: return "subtitle"
        case .timecode: return "timecode"
        case .metadata: return "metadata"
        case .muxed: return "muxed"
        default: return nil
        }
    }

    static func stringFromMetadataValue(_ value: Any?) -> String? {
        switch value {
        case let s as String: return s
        case let n as NSNumber: return n.stringValue
        case let d as Date: return ISO8601DateFormatter().string(from: d)
        case let data as Data: return "Data(\(data.count) bytes)"
        default: return value.map { String(describing: $0) }
        }
    }
}
