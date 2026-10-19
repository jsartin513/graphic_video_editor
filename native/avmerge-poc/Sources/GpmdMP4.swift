import Foundation

/// Minimal ISO BMFF reader for GoPro `gpmd` (GPMF) metadata track extraction.
/// Pure Swift — no FFmpeg. Used to validate telemetry survival and prototype post-AVF patching.
enum GpmdMP4 {
    struct Sample {
        let offset: UInt64
        let size: UInt32
        let durationTicks: UInt32
        let compositionOffset: Int64
    }

    struct GpmdTrack {
        let timescale: UInt32
        let samples: [Sample]
        let sampleDescription: Data
        let handlerName: String
        let trackHeader: Data
        let mediaHeader: Data
    }

    struct FileIndex {
        let path: String
        let gpmd: GpmdTrack?
        let tmcdTrackID: UInt32?
        let videoTimescale: UInt32?
        let durationSeconds: Double?
    }

    enum MP4Error: Error, CustomStringConvertible {
        case invalid(String)
        var description: String {
            switch self { case .invalid(let m): return m }
        }
    }

    static func indexFile(at url: URL) throws -> FileIndex {
        let data = try Data(contentsOf: url, options: [.mappedIfSafe])
        let reader = AtomReader(data: data)
        guard let moov = reader.firstTopLevelAtom(named: "moov") else {
            throw MP4Error.invalid("no moov")
        }
        var gpmd: GpmdTrack?
        var tmcdID: UInt32?
        var videoTS: UInt32?
        var movieDuration: Double?

        moov.forEachChild { atom in
            if atom.name == "mvhd", let mv = parseMvhd(atom.data) {
                movieDuration = mv.durationSeconds
            }
            if atom.name == "trak" {
                if let trak = parseTrak(atom) {
                    if trak.hasGpmd {
                        gpmd = trak.gpmd
                    }
                    if trak.isTmcd {
                        tmcdID = trak.trackID
                    }
                    if trak.isVideo {
                        videoTS = trak.timescale
                    }
                }
            }
        }

        return FileIndex(
            path: url.path,
            gpmd: gpmd,
            tmcdTrackID: tmcdID,
            videoTimescale: videoTS,
            durationSeconds: movieDuration
        )
    }

    /// Concatenate gpmd sample tables from sequential clips (lossless payload copy plan).
    static func planGpmdConcat(inputs: [URL]) throws -> ConcatPlan {
        var segments: [ConcatSegment] = []
        var totalSamples = 0
        var totalBytes: UInt64 = 0
        var timescale: UInt32?
        var sampleDesc: Data?

        for url in inputs {
            let idx = try indexFile(at: url)
            guard let gpmd = idx.gpmd else {
                throw MP4Error.invalid("no gpmd track in \(url.lastPathComponent)")
            }
            if timescale == nil { timescale = gpmd.timescale }
            if sampleDesc == nil { sampleDesc = gpmd.sampleDescription }
            segments.append(ConcatSegment(path: url.path, track: gpmd))
            totalSamples += gpmd.samples.count
            totalBytes += gpmd.samples.reduce(0) { $0 + UInt64($1.size) }
        }

        return ConcatPlan(
            timescale: timescale ?? 1000,
            sampleDescriptionByteLength: sampleDesc?.count ?? 0,
            segments: segments,
            totalSampleCount: totalSamples,
            totalPayloadBytes: totalBytes
        )
    }

    struct ConcatPlan: Codable {
        let timescale: UInt32
        let sampleDescriptionByteLength: Int
        let segments: [ConcatSegment]
        let totalSampleCount: Int
        let totalPayloadBytes: UInt64
    }

    struct ConcatSegment: Codable {
        let path: String
        let sampleCount: Int
        let payloadBytes: UInt64
        let timescale: UInt32

        init(path: String, track: GpmdTrack) {
            self.path = path
            self.sampleCount = track.samples.count
            self.payloadBytes = track.samples.reduce(0) { $0 + UInt64($1.size) }
            self.timescale = track.timescale
        }
    }

    /// Dump first GPMF payload bytes as hex preview (not full parser).
    static func firstGpmdPayloadHex(at url: URL, maxBytes: Int = 64) throws -> String {
        let idx = try indexFile(at: url)
        guard let gpmd = idx.gpmd, let first = gpmd.samples.first else {
            throw MP4Error.invalid("no gpmd samples")
        }
        let file = try Data(contentsOf: url, options: [.mappedIfSafe])
        let start = Int(first.offset)
        let end = min(start + maxBytes, file.count)
        return file[start..<end].map { String(format: "%02x", $0) }.joined(separator: " ")
    }

    // MARK: - trak parsing

    private struct ParsedTrak {
        let trackID: UInt32
        let timescale: UInt32
        let isVideo: Bool
        let isTmcd: Bool
        let hasGpmd: Bool
        let gpmd: GpmdTrack?
    }

    private static func parseTrak(_ atom: Atom) -> ParsedTrak? {
        var trackID: UInt32 = 0
        var timescale: UInt32 = 0
        var handlerSubtype = ""
        var handlerName = ""
        var isVideo = false
        var isTmcd = false
        var stsd: Data?
        var stts: [(count: UInt32, duration: UInt32)] = []
        var stsz: [UInt32] = []
        var stco: [UInt32] = []
        var co64: [UInt64] = []
        var tkhdData = Data()
        var mdhdData = Data()

        atom.forEachChild { child in
            if child.name == "tkhd" { tkhdData = child.data }
            if child.name == "mdia" {
                child.forEachChild { mdia in
                    if mdia.name == "mdhd", let ts = parseMdhd(mdia.data) {
                        timescale = ts
                        mdhdData = mdia.data
                    }
                    if mdia.name == "hdlr", let h = parseHdlr(mdia.data) {
                        handlerSubtype = h.subtype
                        handlerName = h.name
                        isVideo = h.subtype == "vide"
                        isTmcd = h.subtype == "tmcd"
                    }
                    if mdia.name == "minf" {
                        mdia.forEachChild { minf in
                            if minf.name == "stbl" {
                                minf.forEachChild { stbl in
                                    switch stbl.name {
                                    case "stsd": stsd = stbl.data
                                    case "stts": stts = parseStts(stbl.data)
                                    case "stsz": stsz = parseStsz(stbl.data)
                                    case "stco": stco = parseStco(stbl.data)
                                    case "co64": co64 = parseCo64(stbl.data)
                                    default: break
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if tkhdData.count >= 16 {
            trackID = readU32(tkhdData, 12)
        }

        let hasGpmd = stsdContainsFourCC(stsd, fourCC: "gpmd")
        var gpmdTrack: GpmdTrack?
        if hasGpmd, let stsdData = stsd {
            let samples = buildSamples(stts: stts, stsz: stsz, stco: stco, co64: co64)
            gpmdTrack = GpmdTrack(
                timescale: timescale,
                samples: samples,
                sampleDescription: stsdData,
                handlerName: handlerName,
                trackHeader: tkhdData,
                mediaHeader: mdhdData
            )
        }

        return ParsedTrak(
            trackID: trackID,
            timescale: timescale,
            isVideo: isVideo,
            isTmcd: isTmcd,
            hasGpmd: hasGpmd,
            gpmd: gpmdTrack
        )
    }

    private static func stsdContainsFourCC(_ stsd: Data?, fourCC: String) -> Bool {
        guard let stsd, stsd.count >= 16 else { return false }
        let bytes = [UInt8](stsd)
        for i in 0..<(bytes.count - 4) {
            if String(bytes: bytes[i..<i + 4], encoding: .ascii) == fourCC { return true }
        }
        return false
    }

    private static func buildSamples(
        stts: [(count: UInt32, duration: UInt32)],
        stsz: [UInt32],
        stco: [UInt32],
        co64: [UInt64]
    ) -> [Sample] {
        var durations: [UInt32] = []
        for entry in stts {
            for _ in 0..<entry.count { durations.append(entry.duration) }
        }
        let count = stsz.count
        var offsets: [UInt64] = []
        if !co64.isEmpty { offsets = co64 }
        else { offsets = stco.map { UInt64($0) } }

        var samples: [Sample] = []
        for i in 0..<min(count, offsets.count) {
            let dur = i < durations.count ? durations[i] : 0
            samples.append(Sample(offset: offsets[i], size: stsz[i], durationTicks: dur, compositionOffset: 0))
        }
        return samples
    }

    private static func parseMvhd(_ data: Data) -> (durationSeconds: Double, timescale: UInt32)? {
        guard data.count >= 24 else { return nil }
        let version = data[0]
        if version == 0 {
            let timescale = readU32(data, 12)
            let duration = readU32(data, 16)
            guard timescale > 0 else { return nil }
            return (Double(duration) / Double(timescale), timescale)
        }
        if version == 1, data.count >= 32 {
            let timescale = readU32(data, 20)
            let durHi = readU32(data, 24)
            let durLo = readU32(data, 28)
            let duration = (UInt64(durHi) << 32) | UInt64(durLo)
            guard timescale > 0 else { return nil }
            return (Double(duration) / Double(timescale), timescale)
        }
        return nil
    }

    private static func parseMdhd(_ data: Data) -> UInt32? {
        guard data.count >= 20 else { return nil }
        let version = data[0]
        if version == 0 {
            return readU32(data, 12)
        }
        if version == 1, data.count >= 32 {
            return readU32(data, 20)
        }
        return nil
    }

    private static func parseHdlr(_ data: Data) -> (subtype: String, name: String)? {
        guard data.count >= 24 else { return nil }
        let subtype = fourCC(data, 8)
        let nameStart = 24
        let name = String(data: data[nameStart...], encoding: .utf8)?
            .trimmingCharacters(in: .controlCharacters.union(.whitespacesAndNewlines)) ?? ""
        return (subtype, name)
    }

    private static func parseStts(_ data: Data) -> [(UInt32, UInt32)] {
        guard data.count >= 12 else { return [] }
        let count = Int(readU32(data, 4))
        var out: [(UInt32, UInt32)] = []
        var offset = 8
        for _ in 0..<count {
            guard offset + 8 <= data.count else { break }
            out.append((readU32(data, offset), readU32(data, offset + 4)))
            offset += 8
        }
        return out
    }

    private static func parseStsz(_ data: Data) -> [UInt32] {
        guard data.count >= 12 else { return [] }
        let defaultSize = readU32(data, 4)
        let count = Int(readU32(data, 8))
        if defaultSize != 0 {
            return Array(repeating: defaultSize, count: count)
        }
        var sizes: [UInt32] = []
        var offset = 12
        for _ in 0..<count {
            guard offset + 4 <= data.count else { break }
            sizes.append(readU32(data, offset))
            offset += 4
        }
        return sizes
    }

    private static func parseStco(_ data: Data) -> [UInt32] {
        guard data.count >= 8 else { return [] }
        let count = Int(readU32(data, 4))
        var out: [UInt32] = []
        var offset = 8
        for _ in 0..<count {
            guard offset + 4 <= data.count else { break }
            out.append(readU32(data, offset))
            offset += 4
        }
        return out
    }

    private static func parseCo64(_ data: Data) -> [UInt64] {
        guard data.count >= 8 else { return [] }
        let count = Int(readU32(data, 4))
        var out: [UInt64] = []
        var offset = 8
        for _ in 0..<count {
            guard offset + 8 <= data.count else { break }
            out.append(readU64(data, offset))
            offset += 8
        }
        return out
    }

    private static func readU32(_ data: Data, _ offset: Int) -> UInt32 {
        guard offset + 4 <= data.count else { return 0 }
        return UInt32(data[offset]) << 24 | UInt32(data[offset + 1]) << 16 | UInt32(data[offset + 2]) << 8 | UInt32(data[offset + 3])
    }

    private static func readU64(_ data: Data, _ offset: Int) -> UInt64 {
        guard offset + 8 <= data.count else { return 0 }
        return (UInt64(readU32(data, offset)) << 32) | UInt64(readU32(data, offset + 4))
    }

    private static func fourCC(_ data: Data, _ offset: Int) -> String {
        guard offset + 4 <= data.count else { return "????" }
        return String(bytes: data[offset..<offset + 4], encoding: .ascii) ?? "????"
    }
}

// MARK: - Atom tree

private struct Atom {
    let name: String
    let data: Data
    let children: [Atom]

    func forEachChild(_ body: (Atom) -> Void) {
        children.forEach(body)
    }
}

private struct AtomReader {
    let data: Data

    private struct BoxHeader {
        let name: String
        let headerSize: Int
        let totalSize: Int
    }

    func firstTopLevelAtom(named target: String) -> Atom? {
        parse(offset: 0, end: data.count)?.children.first { $0.name == target }
    }

    private func parse(offset: Int, end: Int) -> Atom? {
        Atom(name: "root", data: Data(), children: parseChildren(start: offset, end: end))
    }

    private func parseChildren(start: Int, end: Int) -> [Atom] {
        var children: [Atom] = []
        var pos = start
        while pos < end {
            guard let header = readBoxHeader(at: pos, containerEnd: end) else { break }
            let payloadStart = pos + header.headerSize
            let boxEnd = pos + header.totalSize
            let containerTypes = ["moov", "trak", "mdia", "minf", "stbl", "gmhd", "edts"]
            let childAtoms: [Atom]
            if containerTypes.contains(header.name) {
                childAtoms = parseChildren(start: payloadStart, end: boxEnd)
            } else {
                childAtoms = []
            }
            let payload = data[payloadStart..<boxEnd]
            children.append(Atom(name: header.name, data: Data(payload), children: childAtoms))
            pos = boxEnd
        }
        return children
    }

    /// ISO BMFF box header: size 0 → to container end; size 1 → 64-bit `largesize` after type.
    private func readBoxHeader(at pos: Int, containerEnd: Int) -> BoxHeader? {
        guard pos + 8 <= containerEnd else { return nil }
        let size32 = readU32(pos)
        let name = fourCC(pos + 4)

        if size32 == 0 {
            let total = containerEnd - pos
            guard total >= 8 else { return nil }
            return BoxHeader(name: name, headerSize: 8, totalSize: total)
        }

        if size32 == 1 {
            guard pos + 16 <= containerEnd else { return nil }
            let largeSize = readU64(pos + 8)
            guard largeSize >= 16 else { return nil }
            let total = Int(largeSize)
            guard total >= 16, pos + total <= containerEnd else { return nil }
            return BoxHeader(name: name, headerSize: 16, totalSize: total)
        }

        let total = Int(size32)
        guard total >= 8, pos + total <= containerEnd else { return nil }
        return BoxHeader(name: name, headerSize: 8, totalSize: total)
    }

    private func readU32(_ offset: Int) -> UInt32 {
        UInt32(data[offset]) << 24 | UInt32(data[offset + 1]) << 16 | UInt32(data[offset + 2]) << 8 | UInt32(data[offset + 3])
    }

    private func readU64(_ offset: Int) -> UInt64 {
        (UInt64(readU32(offset)) << 32) | UInt64(readU32(offset + 4))
    }

    private func fourCC(_ offset: Int) -> String {
        String(bytes: data[offset..<offset + 4], encoding: .ascii) ?? "????"
    }
}
