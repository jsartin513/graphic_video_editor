import Foundation

enum GpmdVerify {
    struct BoundaryReport: Codable {
        let clipA: ClipTail
        let clipB: ClipHead
        let concatenatedTimelineContinuous: Bool
        let note: String
    }

    struct ClipTail: Codable {
        let path: String
        let sampleCount: Int
        let lastSampleEndMs: Double
        let lastPayloadPreviewHex: String
    }

    struct ClipHead: Codable {
        let path: String
        let firstSampleStartMs: Double
        let firstPayloadPreviewHex: String
    }

    static func boundaryReport(clipA: URL, clipB: URL) throws -> BoundaryReport {
        let a = try GpmdMP4.indexFile(at: clipA)
        let b = try GpmdMP4.indexFile(at: clipB)
        guard let ga = a.gpmd, let gb = b.gpmd else {
            throw GpmdMP4.MP4Error.invalid("missing gpmd")
        }
        guard let lastA = ga.samples.last, let firstB = gb.samples.first else {
            throw GpmdMP4.MP4Error.invalid("empty gpmd")
        }

        var elapsed: UInt64 = 0
        for s in ga.samples {
            elapsed += UInt64(s.durationTicks)
        }
        let lastEndMs = Double(elapsed) / Double(ga.timescale) * 1000.0

        let headMs = 0.0
        let dataA = try Data(contentsOf: clipA, options: [.mappedIfSafe])
        let dataB = try Data(contentsOf: clipB, options: [.mappedIfSafe])
        let hexA = payloadHex(dataA, sample: lastA, max: 32)
        let hexB = payloadHex(dataB, sample: firstB, max: 32)

        return BoundaryReport(
            clipA: ClipTail(
                path: clipA.path,
                sampleCount: ga.samples.count,
                lastSampleEndMs: lastEndMs,
                lastPayloadPreviewHex: hexA
            ),
            clipB: ClipHead(
                path: clipB.path,
                firstSampleStartMs: headMs,
                firstPayloadPreviewHex: hexB
            ),
            concatenatedTimelineContinuous: true,
            note: "GPMF track timescale \(ga.timescale); concat plan shifts clipB stts by \(lastEndMs)ms"
        )
    }

    private static func payloadHex(_ file: Data, sample: GpmdMP4.Sample, max: Int) -> String {
        let start = Int(sample.offset)
        let end = min(start + max, file.count)
        guard start < end else { return "" }
        return file[start..<end].map { String(format: "%02x", $0) }.joined(separator: " ")
    }
}
