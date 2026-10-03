import SwiftUI
import MessageUI

struct DiagnosticsView: View {
    @EnvironmentObject private var model: MetronomeModel
    @State private var note = ""
    @State private var report = ""
    @State private var status = ""
    @State private var busy = false
    @State private var outgoing: DiagnosticOutgoing?
    private var bodyText: String {
        "To: lazywc@gmail.com\nBunny Metronome iOS \(model.appVersion)\n\n\(note)\n\n\(report)"
    }
    var body: some View {
        DisclosureGroup(model.t("diagnostics")) {
            VStack(alignment: .leading, spacing: 12) {
                Text(model.t("diagnostic_help")).font(.footnote)
                TextField(model.t("diagnostic_note"), text: $note, axis: .vertical)
                    .lineLimit(2...4).textFieldStyle(.roundedBorder)
                    .onChange(of: note) { value in note = String(value.prefix(1200)) }
                Button(model.t("diagnostic_refresh")) { Task { await refresh() } }.disabled(busy)
                ScrollView {
                    Text(report).font(.system(size: 11, design: .monospaced))
                        .textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading)
                }.frame(height: 150).accessibilityLabel(model.t("diagnostic_preview"))
                Button(model.t("diagnostic_send")) {
                    // Freeze exactly the previewed payload, not a second snapshot after sharing opens.
                    outgoing = DiagnosticOutgoing(text: bodyText, subject: "Bunny Metronome iOS · \(model.appVersion)")
                }.disabled(busy || report.isEmpty)
                Button(model.t("diagnostic_copy")) {
                    UIPasteboard.general.string = bodyText
                    status = model.t("diagnostic_copied")
                }.disabled(busy || report.isEmpty)
                Button(model.t("diagnostic_clear")) {
                    Task { await refresh(clearing: true) }
                }.disabled(busy)
                Text(status).font(.footnote).accessibilityAddTraits(.updatesFrequently)
            }.padding(.top, 8)
        }
        .task { await refresh() }
        .sheet(item: $outgoing) { payload in
            if MFMailComposeViewController.canSendMail() {
                DiagnosticMail(payload: payload) { key in status = model.t(key); outgoing = nil }
            } else {
                DiagnosticShare(payload: payload) { key in status = model.t(key); outgoing = nil }
            }
        }
    }
    @MainActor private func refresh(clearing: Bool = false) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        var cleared = true
        if clearing { cleared = await LocalDiagnostics.shared.clear(); note = "" }
        report = await model.diagnosticReport()
        status = clearing ? model.t(cleared ? "diagnostic_cleared" : "diagnostic_failed") : ""
    }

}
private struct DiagnosticOutgoing: Identifiable {
    let id = UUID()
    let text: String
    let subject: String
}
private struct DiagnosticMail: UIViewControllerRepresentable {
    let payload: DiagnosticOutgoing
    let finish: (String) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(finish) }
    func makeUIViewController(context: Context) -> MFMailComposeViewController {
        let vc = MFMailComposeViewController()
        vc.mailComposeDelegate = context.coordinator
        vc.setToRecipients(["lazywc@gmail.com"])
        vc.setSubject(payload.subject)
        vc.setMessageBody(payload.text, isHTML: false)
        return vc
    }
    func updateUIViewController(_ vc: MFMailComposeViewController, context: Context) {}
    final class Coordinator: NSObject, MFMailComposeViewControllerDelegate {
        let finish: (String) -> Void
        init(_ finish: @escaping (String) -> Void) { self.finish = finish }
        func mailComposeController(_ controller: MFMailComposeViewController, didFinishWith result: MFMailComposeResult, error: Error?) {
            finish(error != nil || result == .failed ? "diagnostic_failed" : result == .cancelled ? "diagnostic_cancelled" : "diagnostic_handoff")
        }
    }
}
private struct DiagnosticShare: UIViewControllerRepresentable {
    let payload: DiagnosticOutgoing
    let finish: (String) -> Void
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let vc = UIActivityViewController(activityItems: [payload.text], applicationActivities: nil)
        vc.completionWithItemsHandler = { _, completed, _, error in
            DispatchQueue.main.async { finish(error != nil ? "diagnostic_failed" : completed ? "diagnostic_handoff" : "diagnostic_cancelled") }
        }
        return vc
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
