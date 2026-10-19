// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "avmerge-poc",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "avmerge-poc", targets: ["avmerge-poc"]),
    ],
    targets: [
        .executableTarget(
            name: "avmerge-poc",
            path: "Sources"
        ),
    ]
)
