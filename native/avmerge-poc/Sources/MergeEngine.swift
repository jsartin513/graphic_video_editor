import AVFoundation
import Foundation

enum MergeEngine: String, Codable {
    case exportSession
    case assetWriter
}

struct MergeReport: Codable {
    let engine: MergeEngine
    let outputPath: String
    let outputFileType: String
    let inputPaths: [String]
    let compositionDurationSeconds: Double
    let trimApplied: TrimReport?
    let tracksInComposition: [CompositionTrackReport]
    let exportStatus: String?
    let exportError: String?
    let writerTracksWritten: Int?
    var wallClockSeconds: Double?
}

struct TrimReport: Codable {
    let startSeconds: Double?
    let endSeconds: Double?
}

struct CompositionTrackReport: Codable {
    let mediaType: String
    let trackID: Int32
    let durationSeconds: Double
    let formatDescriptions: [String]
}

enum Merger {
    /// Match tracks across clips by media type + format description fingerprint.
    struct TrackKey: Hashable {
        let mediaType: AVMediaType
        let fingerprint: String
    }

    static func merge(
        inputs: [URL],
        outputURL: URL,
        engine: MergeEngine,
        trimRange: CMTimeRange?
    ) async throws -> MergeReport {
        if FileManager.default.fileExists(atPath: outputURL.path) {
            try FileManager.default.removeItem(at: outputURL)
        }

        let assets = inputs.map { AVURLAsset(url: $0) }
        for asset in assets {
            _ = try await asset.load(.tracks, .duration, .preferredTransform)
        }

        let (composition, trackReports) = try await buildComposition(assets: assets)
        let compositionDuration = try await composition.load(.duration)

        let parent = outputURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: parent, withIntermediateDirectories: true)

        let fileType = outputFileType(for: outputURL)
        let trimReport: TrimReport? = trimRange.map {
            TrimReport(
                startSeconds: $0.start.isValid ? $0.start.seconds : nil,
                endSeconds: $0.end.isValid ? $0.end.seconds : nil
            )
        }

        switch engine {
        case .exportSession:
            let (status, error) = try await exportWithSession(
                composition: composition,
                outputURL: outputURL,
                fileType: fileType,
                trimRange: trimRange
            )
            return MergeReport(
                engine: engine,
                outputPath: outputURL.path,
                outputFileType: fileType.rawValue,
                inputPaths: inputs.map(\.path),
                compositionDurationSeconds: compositionDuration.seconds,
                trimApplied: trimReport,
                tracksInComposition: trackReports,
                exportStatus: status,
                exportError: error,
                writerTracksWritten: nil,
                wallClockSeconds: nil
            )
        case .assetWriter:
            let written = try await exportWithAssetWriter(
                asset: composition,
                outputURL: outputURL,
                fileType: fileType,
                trimRange: trimRange
            )
            return MergeReport(
                engine: engine,
                outputPath: outputURL.path,
                outputFileType: fileType.rawValue,
                inputPaths: inputs.map(\.path),
                compositionDurationSeconds: compositionDuration.seconds,
                trimApplied: trimReport,
                tracksInComposition: trackReports,
                exportStatus: "completed",
                exportError: nil,
                writerTracksWritten: written,
                wallClockSeconds: nil
            )
        }
    }

    static func outputFileType(for url: URL) -> AVFileType {
        switch url.pathExtension.lowercased() {
        case "mov": return .mov
        default: return .mp4
        }
    }

    static func buildComposition(assets: [AVURLAsset]) async throws -> (AVMutableComposition, [CompositionTrackReport]) {
        let composition = AVMutableComposition()
        var cursor = CMTime.zero
        var trackByKey: [TrackKey: AVMutableCompositionTrack] = [:]

        for asset in assets {
            let duration = try await asset.load(.duration)
            let range = CMTimeRange(start: .zero, duration: duration)
            let tracks = try await asset.load(.tracks)

            for track in tracks {
                let fds = try await track.load(.formatDescriptions)
                let fp = trackFingerprint(mediaType: track.mediaType, formatDescriptions: fds)
                let key = TrackKey(mediaType: track.mediaType, fingerprint: fp)

                let compTrack: AVMutableCompositionTrack
                if let existing = trackByKey[key] {
                    compTrack = existing
                } else {
                    guard let created = composition.addMutableTrack(
                        withMediaType: track.mediaType,
                        preferredTrackID: kCMPersistentTrackID_Invalid
                    ) else {
                        throw NSError(
                            domain: "avmerge-poc",
                            code: 1,
                            userInfo: [NSLocalizedDescriptionKey: "Could not add \(track.mediaType.rawValue) track (\(fp))"]
                        )
                    }
                    trackByKey[key] = created
                    compTrack = created
                }

                try compTrack.insertTimeRange(range, of: track, at: cursor)
            }
            cursor = CMTimeAdd(cursor, duration)
        }

        var reports: [CompositionTrackReport] = []
        for track in composition.tracks {
            let fds = try await track.load(.formatDescriptions)
            let dur = try await track.load(.timeRange).duration
            reports.append(
                CompositionTrackReport(
                    mediaType: track.mediaType.rawValue,
                    trackID: track.trackID,
                    durationSeconds: dur.seconds,
                    formatDescriptions: fds.map { formatDescriptionSummary($0) }
                )
            )
        }
        return (composition, reports)
    }

    static func trackFingerprint(mediaType: AVMediaType, formatDescriptions: [CMFormatDescription]) -> String {
        let parts = formatDescriptions.map { formatDescriptionSummary($0) }
        if parts.isEmpty {
            return mediaType.rawValue
        }
        return parts.joined(separator: "|")
    }

    static func exportWithSession(
        composition: AVMutableComposition,
        outputURL: URL,
        fileType: AVFileType,
        trimRange: CMTimeRange?
    ) async throws -> (String, String?) {
        guard let session = AVAssetExportSession(
            asset: composition,
            presetName: AVAssetExportPresetPassthrough
        ) else {
            throw NSError(
                domain: "avmerge-poc",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "AVAssetExportSession could not be created"]
            )
        }

        session.outputURL = outputURL
        session.outputFileType = fileType
        session.shouldOptimizeForNetworkUse = false
        if let trimRange {
            session.timeRange = trimRange
        }

        await session.export()

        let status: String
        switch session.status {
        case .completed: status = "completed"
        case .failed: status = "failed"
        case .cancelled: status = "cancelled"
        case .exporting: status = "exporting"
        case .waiting: status = "waiting"
        case .unknown: status = "unknown"
        @unknown default: status = "unknown"
        }

        return (status, session.error?.localizedDescription)
    }

    static func exportWithAssetWriter(
        asset: AVAsset,
        outputURL: URL,
        fileType: AVFileType,
        trimRange: CMTimeRange?
    ) async throws -> Int {
        let assetDuration = try await asset.load(.duration)
        let timeRange = trimRange ?? CMTimeRange(start: .zero, duration: assetDuration)

        let reader = try AVAssetReader(asset: asset)
        reader.timeRange = timeRange

        let writer = try AVAssetWriter(outputURL: outputURL, fileType: fileType)
        writer.shouldOptimizeForNetworkUse = false

        let tracks = try await asset.load(.tracks)
        struct Pipe {
            let output: AVAssetReaderTrackOutput
            let input: AVAssetWriterInput
        }
        var pipes: [Pipe] = []

        for track in tracks {
            let fds = try await track.load(.formatDescriptions)
            guard let hint = fds.first else { continue }

            let output = AVAssetReaderTrackOutput(track: track, outputSettings: nil)
            output.alwaysCopiesSampleData = false
            guard reader.canAdd(output) else {
                throw NSError(domain: "avmerge-poc", code: 3, userInfo: [NSLocalizedDescriptionKey: "Reader cannot add output for \(track.mediaType.rawValue)"])
            }
            reader.add(output)

            let input = AVAssetWriterInput(mediaType: track.mediaType, outputSettings: nil, sourceFormatHint: hint)
            input.expectsMediaDataInRealTime = false
            guard writer.canAdd(input) else {
                // e.g. tmcd / metadata tracks are often rejected by AVAssetWriter for MP4.
                continue
            }
            writer.add(input)
            pipes.append(Pipe(output: output, input: input))
        }

        guard !pipes.isEmpty else {
            throw NSError(domain: "avmerge-poc", code: 5, userInfo: [NSLocalizedDescriptionKey: "No tracks to write"])
        }

        guard writer.startWriting() else {
            throw writer.error ?? NSError(domain: "avmerge-poc", code: 6, userInfo: [NSLocalizedDescriptionKey: "startWriting failed"])
        }
        reader.startReading()
        writer.startSession(atSourceTime: timeRange.start)

        try await withThrowingTaskGroup(of: Void.self) { group in
            for pipe in pipes {
                group.addTask {
                    try await pump(from: pipe.output, to: pipe.input, reader: reader, writer: writer)
                }
            }
            try await group.waitForAll()
        }

        if reader.status == .failed {
            throw reader.error ?? NSError(domain: "avmerge-poc", code: 7, userInfo: [NSLocalizedDescriptionKey: "Reader failed"])
        }

        await writer.finishWriting()
        if writer.status == .failed {
            throw writer.error ?? NSError(domain: "avmerge-poc", code: 8, userInfo: [NSLocalizedDescriptionKey: "Writer failed"])
        }

        return pipes.count
    }

    static func pump(
        from output: AVAssetReaderTrackOutput,
        to input: AVAssetWriterInput,
        reader: AVAssetReader,
        writer: AVAssetWriter
    ) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            let queue = DispatchQueue(label: "avmerge-poc.pump")
            input.requestMediaDataWhenReady(on: queue) {
                while input.isReadyForMoreMediaData {
                    if reader.status == .failed {
                        input.markAsFinished()
                        continuation.resume(throwing: reader.error ?? NSError(domain: "avmerge-poc", code: 9, userInfo: nil))
                        return
                    }
                    if let sample = output.copyNextSampleBuffer() {
                        if !input.append(sample) {
                            input.markAsFinished()
                            continuation.resume(throwing: writer.error ?? NSError(domain: "avmerge-poc", code: 10, userInfo: [NSLocalizedDescriptionKey: "append failed"]))
                            return
                        }
                    } else {
                        input.markAsFinished()
                        continuation.resume()
                        return
                    }
                }
            }
        }
    }
}

func formatDescriptionSummary(_ desc: CMFormatDescription) -> String {
    let mediaSubType = CMFormatDescriptionGetMediaSubType(desc)
    let fourCC = fourCCString(mediaSubType)
    let mediaType = CMFormatDescriptionGetMediaType(desc)
    let typeStr = fourCCString(mediaType)

    if mediaType == kCMMediaType_Video {
        var width = 0
        var height = 0
        if let extensions = CMFormatDescriptionGetExtensions(desc) as? [String: Any] {
            if let cleanAperture = extensions["CleanAperture"] as? [String: Any] {
                width = cleanAperture["Width"] as? Int ?? 0
                height = cleanAperture["Height"] as? Int ?? 0
            }
        }
        if width == 0 {
            width = Int(desc.dimensions.width)
            height = Int(desc.dimensions.height)
        }
        return "video/\(fourCC) \(width)x\(height)"
    }
    if mediaType == kCMMediaType_Audio {
        if let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(desc)?.pointee {
            return String(format: "audio/%@ %.0fHz %dch", fourCC, asbd.mSampleRate, Int(asbd.mChannelsPerFrame))
        }
        return "audio/\(fourCC)"
    }
    if mediaType == kCMMediaType_TimeCode {
        return "timecode/\(fourCC)"
    }
    if mediaType == kCMMediaType_Metadata {
        return "metadata/\(fourCC)"
    }
    return "\(typeStr)/\(fourCC)"
}

func fourCCString(_ code: FourCharCode) -> String {
    let bytes: [UInt8] = [
        UInt8((code >> 24) & 0xff),
        UInt8((code >> 16) & 0xff),
        UInt8((code >> 8) & 0xff),
        UInt8(code & 0xff),
    ]
    if bytes.allSatisfy({ $0 >= 32 && $0 < 127 }) {
        return String(bytes: bytes, encoding: .ascii) ?? String(format: "0x%08X", code)
    }
    return String(format: "0x%08X", code)
}

private extension CMFormatDescription {
    var dimensions: CMVideoDimensions {
        CMVideoFormatDescriptionGetDimensions(self)
    }
}

private extension CMTime {
    var seconds: Double {
        CMTimeGetSeconds(self)
    }
}
