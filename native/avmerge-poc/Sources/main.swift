import AVFoundation
import Foundation

enum CLIError: Error, CustomStringConvertible {
    case usage(String)
    case failed(String)

    var description: String {
        switch self {
        case .usage(let msg): return msg
        case .failed(let msg): return "Error: \(msg)"
        }
    }
}

@main
struct AvMergePOC {
    static func main() async {
        do {
            try await run()
        } catch {
            fputs("\(error)\n", stderr)
            exit(1)
        }
    }

    static func run() async throws {
        var args = Array(CommandLine.arguments.dropFirst())
        guard let command = args.first else {
            throw CLIError.usage(usageText)
        }
        args.removeFirst()

        switch command {
        case "merge":
            try await mergeCommand(args: args)
        case "probe":
            try await probeCommand(args: args)
        case "help", "-h", "--help":
            print(usageText)
        default:
            throw CLIError.usage("Unknown command '\(command)'\n\n\(usageText)")
        }
    }

    static let usageText = """
    avmerge-poc — AVFoundation lossless merge spike

    Usage:
      avmerge-poc merge [--output PATH] [--engine export|writer] [--trim-start SEC] [--trim-end SEC] INPUT ...
      avmerge-poc probe INPUT

    Options:
      --engine export   AVAssetExportSession + AVAssetExportPresetPassthrough (default)
      --engine writer   AVAssetReader/AVAssetWriter sample passthrough
      --output          Output file (.mp4 or .mov). Default: merged.mp4 in cwd
    """

    static func mergeCommand(args: [String]) async throws {
        var inputs: [URL] = []
        var outputURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("merged.mp4")
        var engine: MergeEngine = .exportSession
        var trimStart: Double?
        var trimEnd: Double?

        var i = 0
        while i < args.count {
            let arg = args[i]
            switch arg {
            case "--output", "-o":
                i += 1
                guard i < args.count else { throw CLIError.usage("Missing value for --output") }
                outputURL = URL(fileURLWithPath: args[i], isDirectory: false)
            case "--engine":
                i += 1
                guard i < args.count else { throw CLIError.usage("Missing value for --engine") }
                switch args[i] {
                case "export": engine = .exportSession
                case "writer": engine = .assetWriter
                default: throw CLIError.usage("Unknown engine '\(args[i])'")
                }
            case "--trim-start":
                i += 1
                guard i < args.count, let v = Double(args[i]) else {
                    throw CLIError.usage("Invalid --trim-start")
                }
                trimStart = v
            case "--trim-end":
                i += 1
                guard i < args.count, let v = Double(args[i]) else {
                    throw CLIError.usage("Invalid --trim-end")
                }
                trimEnd = v
            case "--help", "-h":
                print(usageText)
                return
            default:
                if arg.hasPrefix("-") {
                    throw CLIError.usage("Unknown option \(arg)")
                }
                inputs.append(URL(fileURLWithPath: (arg as NSString).expandingTildeInPath, isDirectory: false))
            }
            i += 1
        }

        guard inputs.count >= 1 else {
            throw CLIError.usage("merge requires at least one input file\n\n\(usageText)")
        }

        let trimRange: CMTimeRange? = {
            if trimStart == nil && trimEnd == nil { return nil }
            let start = CMTime(seconds: trimStart ?? 0, preferredTimescale: 600)
            if let endSeconds = trimEnd {
                return CMTimeRange(start: start, end: CMTime(seconds: endSeconds, preferredTimescale: 600))
            }
            return CMTimeRange(start: start, duration: .positiveInfinity)
        }()

        let wallStart = CFAbsoluteTimeGetCurrent()
        let result = try await Merger.merge(
            inputs: inputs,
            outputURL: outputURL,
            engine: engine,
            trimRange: trimRange
        )
        let wallSeconds = CFAbsoluteTimeGetCurrent() - wallStart

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        var report = result
        report.wallClockSeconds = wallSeconds
        let data = try encoder.encode(report)
        print(String(data: data, encoding: .utf8)!)
    }

    static func probeCommand(args: [String]) async throws {
        guard let path = args.first else {
            throw CLIError.usage("probe requires INPUT\n\n\(usageText)")
        }
        let url = URL(fileURLWithPath: (path as NSString).expandingTildeInPath, isDirectory: false)
        let asset = AVURLAsset(url: url)
        let tracks = try await asset.load(.tracks)
        let duration = try await asset.load(.duration)

        struct TrackInfo: Codable {
            let index: Int
            let mediaType: String
            let trackID: Int32
            let formatDescriptions: [String]
            let estimatedDataRate: Float
            let languageCode: String?
        }

        var infos: [TrackInfo] = []
        for (idx, track) in tracks.enumerated() {
            let fds = try await track.load(.formatDescriptions)
            let descStrings = fds.map { formatDescriptionSummary($0) }
            let lang = try await track.load(.languageCode)
            let rate = try await track.load(.estimatedDataRate)
            infos.append(
                TrackInfo(
                    index: idx,
                    mediaType: track.mediaType.rawValue,
                    trackID: track.trackID,
                    formatDescriptions: descStrings,
                    estimatedDataRate: rate,
                    languageCode: lang
                )
            )
        }

        struct ProbeResult: Codable {
            let path: String
            let durationSeconds: Double
            let tracks: [TrackInfo]
        }

        let result = ProbeResult(
            path: url.path,
            durationSeconds: duration.seconds,
            tracks: infos
        )
        let data = try JSONEncoder().encode(result)
        print(String(data: data, encoding: .utf8)!)
    }
}
