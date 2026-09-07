import SwiftUI

private enum Palette {
    static let bg = Color(red: 0.992, green: 0.969, blue: 0.945)
    static let surface = Color.white
    static let surface2 = Color(red: 0.984, green: 0.965, blue: 0.953)
    static let ink = Color(red: 0.145, green: 0.118, blue: 0.102)
    static let muted = Color(red: 0.55, green: 0.49, blue: 0.45)
    static let fg2 = Color(red: 0.42, green: 0.37, blue: 0.34)
    static let border = Color(red: 0.93, green: 0.89, blue: 0.86)
    static let coral = Color(red: 0.878, green: 0.478, blue: 0.416)
    static let coralDeep = Color(red: 0.72, green: 0.32, blue: 0.28)
    static let coralSoft = Color(red: 0.98, green: 0.925, blue: 0.91)
    static let mint = Color(red: 0.45, green: 0.82, blue: 0.70)
    static let mintSoft = Color(red: 0.92, green: 0.97, blue: 0.94)
    static let mintDeep = Color(red: 0.18, green: 0.48, blue: 0.40)
    static let lemon = Color(red: 0.96, green: 0.86, blue: 0.42)
    static let lemonSoft = Color(red: 0.99, green: 0.95, blue: 0.82)
    static let lemonDeep = Color(red: 0.52, green: 0.42, blue: 0.10)
    static let lavender = Color(red: 0.78, green: 0.72, blue: 0.90)
    static let lavenderSoft = Color(red: 0.96, green: 0.94, blue: 0.98)
    static let lavenderDeep = Color(red: 0.36, green: 0.28, blue: 0.52)
}

/// Taste-skill: press feedback is scale only, never opacity flash or layout tween.
private struct MacaronPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

private struct BeatGridWidthKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

struct ContentView: View {
    @EnvironmentObject var model: MetronomeModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var beatGridWidth: CGFloat = 0

    var body: some View {
        ZStack {
            background
            VStack(spacing: 12) {
                topBeans
                    .padding(.horizontal, 16)
                heroCard
                    .padding(.horizontal, 16)
                    .frame(maxHeight: .infinity, alignment: .top)
                settingsBar
                    .padding(.horizontal, 16)
                    .padding(.bottom, 10)
            }
        }
        .preferredColorScheme(.light)
        .sheet(isPresented: $model.settingsOpen) {
            settingsSheet
        }
        .task { await model.refreshPrice() }
    }

    private var background: some View {
        Palette.bg
            .ignoresSafeArea()
            .overlay(alignment: .topLeading) {
                RadialGradient(
                    colors: [Color(red: 1, green: 0.82, blue: 0.78).opacity(0.45), .clear],
                    center: .topLeading, startRadius: 10, endRadius: 280
                )
                .ignoresSafeArea()
            }
            .overlay(alignment: .topTrailing) {
                RadialGradient(
                    colors: [Color(red: 0.92, green: 0.82, blue: 0.98).opacity(0.40), .clear],
                    center: .topTrailing, startRadius: 10, endRadius: 260
                )
                .ignoresSafeArea()
            }
            .overlay(alignment: .bottom) {
                RadialGradient(
                    colors: [Color(red: 0.95, green: 0.92, blue: 0.70).opacity(0.35), .clear],
                    center: .bottom, startRadius: 20, endRadius: 320
                )
                .ignoresSafeArea()
            }
    }

    private var topBeans: some View {
        HStack(spacing: 6) {
            Spacer()
            ShareLink(
                item: model.shareURL(),
                subject: Text(model.t("app_name")),
                message: Text(model.t("share_text"))
            ) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .offset(y: -1)
                    .foregroundStyle(Palette.lemonDeep)
                    .frame(width: 36, height: 36)
                    .background(
                        LinearGradient(
                            colors: [Color(red: 0.99, green: 0.95, blue: 0.72), Palette.lemon],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .shadow(color: Palette.lemon.opacity(0.35), radius: 6, y: 3)
            }
            .buttonStyle(MacaronPressStyle())
            .accessibilityLabel(model.t("share"))
            Button {
                model.setLang(model.prefs.lang == "zh" ? "en" : "zh")
            } label: {
                Text(model.prefs.lang == "zh" ? "EN" : "中文")
                    .font(.system(size: 12, weight: .bold))
                    .padding(.horizontal, 10)
                    .frame(height: 36)
                    .background(
                        LinearGradient(
                            colors: [Color(red: 0.93, green: 0.90, blue: 0.98), Color(red: 0.82, green: 0.78, blue: 0.94)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        )
                    )
                    .foregroundStyle(Palette.lavenderDeep)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .shadow(color: Palette.lavender.opacity(0.35), radius: 6, y: 3)
            }
            .accessibilityLabel(model.t("language"))
        }
    }

    private var heroCard: some View {
        VStack(spacing: 0) {
            bunny
                .padding(.top, 8)
            titleBlock
                .padding(.top, 12)
            beatGrid
                .padding(.top, 22)
            bpmBlock
                .padding(.top, 16)
            sliderRow
                .padding(.top, 16)
            playButton
                .padding(.top, 20)
                .padding(.bottom, 8)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 22)
        .background(cardBackground)
        .transaction { $0.animation = nil }
    }

    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: 36, style: .continuous)
            .fill(Palette.surface)
            .shadow(color: Palette.ink.opacity(0.10), radius: 24, y: 12)
            .overlay(
                RoundedRectangle(cornerRadius: 36, style: .continuous)
                    .stroke(Color.white.opacity(0.85), lineWidth: 1)
            )
    }

    private var bunny: some View {
        // PNG is a circular painting on a pale square; crop the white matte
        // so the rabbit fills the clip. Outer ring stays a thin macaron stroke.
        Image("Bunny")
            .resizable()
            .scaledToFill()
            .frame(width: 148, height: 148)
            .offset(y: 6)
            .frame(width: 116, height: 116)
            .clipped()
            .clipShape(Circle())
            .padding(4)
            .background(
                Circle().fill(
                    AngularGradient(
                        colors: [Palette.coral, Palette.lemon, Palette.mint, Palette.lavender, Palette.coral],
                        center: .center
                    )
                )
            )
            .shadow(color: Palette.coral.opacity(0.28), radius: 14, y: 6)
            .accessibilityHidden(true)
    }

    private var titleBlock: some View {
        VStack(spacing: 4) {
            HStack(spacing: 0) {
                Text(model.t("app_name_lead"))
                    .foregroundStyle(Palette.ink)
                Text(model.t("app_name_em"))
                    .italic()
                    .foregroundStyle(Palette.coralDeep)
            }
            .font(.system(size: 26, weight: .heavy, design: .rounded))
            .tracking(-0.6)
            Text(model.t("tagline"))
                .font(.system(size: 12.5, weight: .medium))
                .foregroundStyle(Palette.muted)
        }
        .multilineTextAlignment(.center)
    }

    private var beatGrid: some View {
        let n = max(1, min(16, model.prefs.bc))
        let spacing: CGFloat = n >= 7 ? 6 : 10
        let rows = MetronomePolicy.beatRows(beats: n)
        let measured = beatGridWidth > 1 ? beatGridWidth : 300
        let cell = max(36, (measured - spacing * CGFloat(MetronomePolicy.beatRowMax - 1)) / CGFloat(MetronomePolicy.beatRowMax))
        return VStack(spacing: spacing) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: spacing) {
                    ForEach(0..<row.count, id: \.self) { j in
                        beatCell(row.startIndex + j, corner: min(18, cell * 0.28))
                            .frame(width: cell, height: cell)
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .frame(maxWidth: .infinity)
        .background(
            GeometryReader { geo in
                Color.clear.preference(key: BeatGridWidthKey.self, value: geo.size.width)
            }
        )
        .onPreferenceChange(BeatGridWidthKey.self) { beatGridWidth = $0 }
        .transaction { $0.animation = nil }
    }

    private func beatCell(_ i: Int, corner: CGFloat) -> some View {
        let active = model.playing && i == model.activeBeat
        let strong = model.prefs.mode == .traditional && i == 0
        let (fill, text, ring) = beatColors()
        return Text("\(i + 1)")
            .font(.system(size: model.prefs.bc >= 8 ? 16 : 22, weight: .bold, design: .rounded))
            .foregroundStyle(strong ? Color.white : text)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .fill(strong
                          ? LinearGradient(colors: [Palette.coral, Palette.coralDeep], startPoint: .top, endPoint: .bottom)
                          : fill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: corner, style: .continuous)
                    .stroke(ring, lineWidth: 1.5)
            )
            .scaleEffect(active && !reduceMotion ? 1.05 : 1)
            .shadow(color: (strong ? Palette.coralDeep : text).opacity(active ? 0.4 : 0.08), radius: active ? 10 : 3, y: active ? 5 : 2)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: active)
            .accessibilityLabel("\(i + 1)")
    }

    private func beatColors() -> (LinearGradient, Color, Color) {
        switch model.prefs.mode {
        case .traditional:
            return (
                LinearGradient(colors: [Palette.lemonSoft, Palette.lemon], startPoint: .topLeading, endPoint: .bottomTrailing),
                Palette.lemonDeep,
                Color(red: 0.85, green: 0.75, blue: 0.35)
            )
        case .uniform:
            return (
                LinearGradient(colors: [Palette.mintSoft, Color(red: 0.78, green: 0.92, blue: 0.86)], startPoint: .topLeading, endPoint: .bottomTrailing),
                Palette.mintDeep,
                Color(red: 0.55, green: 0.82, blue: 0.72)
            )
        case .voice:
            return (
                LinearGradient(colors: [Palette.lavenderSoft, Color(red: 0.88, green: 0.84, blue: 0.96)], startPoint: .topLeading, endPoint: .bottomTrailing),
                Palette.lavenderDeep,
                Color(red: 0.78, green: 0.72, blue: 0.90)
            )
        }
    }

    private var bpmBlock: some View {
        VStack(spacing: 8) {
            Text("\(model.prefs.bpm)")
                .font(.system(size: 84, weight: .heavy, design: .rounded))
                .foregroundStyle(Palette.ink)
                .tracking(-2)
                .monospacedDigit()
                .accessibilityLabel("\(model.prefs.bpm) BPM")
            Text(model.t("bpm"))
                .font(.system(size: 11.5, weight: .heavy))
                .tracking(2.2)
                .foregroundStyle(Palette.coralDeep)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Palette.coralSoft)
                .clipShape(Capsule())
            HStack(spacing: 6) {
                Circle()
                    .fill(model.playing ? Palette.coral : Color(red: 0.82, green: 0.78, blue: 0.74))
                    .frame(width: 7, height: 7)
                    .shadow(color: model.playing ? Palette.coral.opacity(0.5) : .clear, radius: 4)
                Text(model.statusLine)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Palette.fg2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.white.opacity(0.7))
            .overlay(Capsule().stroke(Palette.border, lineWidth: 1))
            .clipShape(Capsule())
        }
    }

    private var sliderRow: some View {
        HStack(spacing: 10) {
            macaronButton("−", enabled: model.prefs.bpm > MetronomePolicy.minBpm) { model.setBpm(model.prefs.bpm - 1) }
                .accessibilityLabel("BPM -1")
            MacaronSlider(
                value: Binding(
                    get: { Double(model.prefs.bpm) },
                    set: { model.setBpm(Int($0.rounded())) }
                ),
                range: Double(MetronomePolicy.minBpm)...Double(MetronomePolicy.maxBpm)
            )
            .frame(height: 28)
            .accessibilityLabel("BPM")
            macaronButton("+", enabled: model.prefs.bpm < MetronomePolicy.maxBpm) { model.setBpm(model.prefs.bpm + 1) }
                .accessibilityLabel("BPM +1")
        }
    }

    private func macaronButton(_ title: String, enabled: Bool = true, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Palette.lemonDeep)
                .frame(width: 36, height: 36)
                .background(
                    LinearGradient(
                        colors: [Palette.lemonSoft, Palette.lemon],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .shadow(color: Palette.lemon.opacity(0.35), radius: 4, y: 2)
                .opacity(enabled ? 1 : 0.38)
        }
        .disabled(!enabled)
        .buttonStyle(MacaronPressStyle())
    }

    private var playButton: some View {
        VStack(spacing: 8) {
            Button {
                model.togglePlay()
            } label: {
                Image(systemName: model.playing ? "pause.fill" : "play.fill")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(.white)
                    .offset(x: model.playing ? 0 : 2)
                    .frame(width: 78, height: 78)
                    .background(
                        Circle().fill(
                            LinearGradient(
                                colors: model.playing
                                    ? [Palette.coral, Palette.coralDeep]
                                    : [Color(red: 0.55, green: 0.86, blue: 0.74), Palette.mintDeep.opacity(0.85)],
                                startPoint: .top, endPoint: .bottom
                            )
                        )
                    )
                    .background(
                        Circle()
                            .fill((model.playing ? Palette.coral : Palette.mint).opacity(0.22))
                            .frame(width: 94, height: 94)
                    )
                    .shadow(color: (model.playing ? Palette.coralDeep : Palette.mintDeep).opacity(0.45), radius: 16, y: 8)
            }
            .buttonStyle(MacaronPressStyle())
            .accessibilityLabel(model.playing ? model.t("pause") : model.t("play"))
            if !model.storeMessage.isEmpty {
                Text(model.storeMessage)
                    .font(.footnote)
                    .foregroundStyle(Palette.fg2)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var settingsBar: some View {
        Button {
            model.settingsOpen = true
        } label: {
            HStack {
                Text(model.t("settings"))
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Palette.ink)
                Spacer()
                Image(systemName: "chevron.up")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Palette.coralDeep)
                    .frame(width: 22, height: 22)
                    .background(Palette.coralSoft)
                    .clipShape(Circle())
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(Palette.surface)
                    .shadow(color: Palette.ink.opacity(0.06), radius: 10, y: 4)
            )
        }
        .buttonStyle(MacaronPressStyle())
        .accessibilityLabel(model.t("settings"))
    }

    private var settingsSheet: some View {
        NavigationStack {
            ScrollView {
                SettingsPanel()
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 32)
            }
            .background(Palette.bg.ignoresSafeArea())
            .navigationTitle(model.t("settings"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(model.t("done")) {
                        model.settingsOpen = false
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(Palette.coralDeep)
                }
            }
        }
        .presentationDetents([.fraction(0.72), .large])
        .presentationDragIndicator(.visible)
    }
}

private struct MacaronSlider: View {
    @Binding var value: Double
    let range: ClosedRange<Double>

    var body: some View {
        GeometryReader { geo in
            let w = Double(geo.size.width)
            let thumb = MetronomePolicy.sliderThumb
            let t = MetronomePolicy.sliderFraction(value: value, start: range.lowerBound, end: range.upperBound)
            let origin = MetronomePolicy.sliderThumbOrigin(fraction: t, width: w, thumb: thumb)
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [Palette.mint, Palette.lemon, Palette.coral],
                            startPoint: .leading, endPoint: .trailing
                        )
                    )
                    .frame(height: 10)
                    .opacity(0.7)
                Circle()
                    .fill(Color.white)
                    .frame(width: CGFloat(thumb), height: CGFloat(thumb))
                    .overlay(Circle().stroke(Palette.coral, lineWidth: 2.5))
                    .shadow(color: Palette.coral.opacity(0.35), radius: 5, y: 2)
                    .offset(x: CGFloat(origin))
            }
            .frame(maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0).onChanged { g in
                    value = MetronomePolicy.sliderValueFromTouch(
                        x: Double(g.location.x),
                        width: w,
                        start: range.lowerBound,
                        end: range.upperBound,
                        thumb: thumb
                    )
                }
            )
        }
    }
}

private struct SettingsGroup<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Palette.muted)
                .padding(.leading, 4)
            content
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Palette.surface)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
    }
}

private struct SettingsPanel: View {
    @EnvironmentObject var model: MetronomeModel

    private let presets: [(Int, Int, String)] = [
        (4, 4, "sig_44"), (3, 4, "sig_34"), (2, 4, "sig_24"),
        (6, 8, "sig_68"), (5, 4, "sig_54"), (7, 8, "sig_78")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            SettingsGroup(title: model.t("sound_mode")) {
                HStack(spacing: 8) {
                    modeTile(.traditional, icon: "🥁")
                    modeTile(.uniform, icon: "🎵")
                    modeTile(.voice, icon: "🗣️")
                }
            }

            SettingsGroup(title: model.t("time_signature")) {
                VStack(spacing: 10) {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                        ForEach(presets, id: \.2) { p in
                            meterChip(p.0, p.1, model.t(p.2))
                        }
                    }
                    HStack(spacing: 10) {
                        stepperChip(model.t("beats"), value: model.prefs.bc, range: 1...16) {
                            model.setSignature(bc: $0, bu: model.prefs.bu)
                        }
                        Text("/")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(Palette.muted)
                        stepperChip(model.t("beat_unit"), value: model.prefs.bu, range: 1...16) {
                            model.setSignature(bc: model.prefs.bc, bu: $0)
                        }
                    }
                }
            }

            SettingsGroup(title: model.t("volume")) {
                HStack(spacing: 10) {
                    Text("\(model.prefs.vol)")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundStyle(Palette.coralDeep)
                        .frame(width: 36, alignment: .leading)
                    MacaronSlider(
                        value: Binding(
                            get: { Double(model.prefs.vol) },
                            set: {
                                model.prefs.vol = MetronomePolicy.clampVolume(Int($0.rounded()))
                                model.applyAudioSettings()
                            }
                        ),
                        range: 10...100
                    )
                    .frame(height: 28)
                }
            }

            SettingsGroup(title: model.t("language")) {
                HStack(spacing: 8) {
                    langChip("中文", "zh")
                    langChip("English", "en")
                }
            }

            SettingsGroup(title: model.t("practice_opts")) {
                VStack(spacing: 0) {
                    settingToggle(model.t("haptic"), on: model.prefs.haptic) { on in
                        model.prefs.haptic = on
                        model.applyAudioSettings()
                    }
                    Rectangle().fill(Palette.border).frame(height: 1)
                    settingToggle(model.t("keep_awake"), on: model.prefs.keepAwake) { on in
                        model.prefs.keepAwake = on
                        model.persist()
                    }
                }
                .padding(.vertical, -4)
            }

            SettingsGroup(title: model.t("sound_workshop")) {
                VStack(alignment: .leading, spacing: 12) {
                    Text(model.t("sound_workshop_blurb"))
                        .font(.system(size: 13))
                        .foregroundStyle(Palette.fg2)
                    Text(model.t("haptic_pack_blurb"))
                        .font(.system(size: 13))
                        .foregroundStyle(Palette.fg2)
                    hapticOptionRow(
                        title: model.t("haptic_pattern"),
                        options: [
                            (MetronomePolicy.hapticPatternAll, model.t("haptic_all")),
                            (MetronomePolicy.hapticPatternDownbeat, model.t("haptic_downbeat"))
                        ],
                        current: MetronomePolicy.resolveHapticPattern(
                            requested: model.prefs.hapticPattern, unlocked: model.unlocked
                        ),
                        unlocked: model.unlocked,
                        freeId: MetronomePolicy.hapticPatternAll
                    ) { model.requestHapticPattern($0) }
                    hapticOptionRow(
                        title: model.t("haptic_feel"),
                        options: [
                            (MetronomePolicy.hapticFeelLight, model.t("haptic_light")),
                            (MetronomePolicy.hapticFeelStandard, model.t("haptic_standard")),
                            (MetronomePolicy.hapticFeelHeavy, model.t("haptic_heavy"))
                        ],
                        current: MetronomePolicy.resolveHapticFeel(
                            requested: model.prefs.hapticFeel, unlocked: model.unlocked
                        ),
                        unlocked: model.unlocked,
                        freeId: MetronomePolicy.hapticFeelStandard
                    ) { model.requestHapticFeel($0) }
                    if model.unlocked {
                        Text(model.t("owned"))
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Palette.mintDeep)
                    } else {
                        Button {
                            Task { await model.buyPack() }
                        } label: {
                            Text(model.buyButtonTitle())
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(
                                    LinearGradient(colors: [Palette.coral, Palette.coralDeep], startPoint: .top, endPoint: .bottom)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .buttonStyle(MacaronPressStyle())
                        .disabled(model.storeBusy || model.productPrice == nil)
                        if model.storeBusy {
                            Text(model.t("buying"))
                                .font(.footnote)
                                .foregroundStyle(Palette.fg2)
                        } else if model.productPrice == nil {
                            Text(model.t("buy_unavailable"))
                                .font(.footnote)
                                .foregroundStyle(Palette.fg2)
                        }
                    }
                    Button {
                        Task { await model.restorePurchases() }
                    } label: {
                        Text(model.t("restore"))
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Palette.coralDeep)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Palette.coralSoft)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(MacaronPressStyle())
                    .disabled(model.storeBusy)
                    if !model.storeMessage.isEmpty {
                        Text(model.storeMessage)
                            .font(.footnote)
                            .foregroundStyle(Palette.fg2)
                    }
                    bankChips(title: model.t("click_bank"), voice: false)
                    bankChips(title: model.t("voice_bank"), voice: true)
                }
            }

            HStack(spacing: 20) {
                Spacer()
                Link(model.t("support"), destination: model.supportURL())
                Link(model.t("privacy"), destination: model.privacyURL())
                Spacer()
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Palette.coral)
            .padding(.top, 4)
        }
    }

    private func modeTile(_ mode: SoundMode, icon: String) -> some View {
        let on = model.prefs.mode == mode
        let label: String = {
            switch mode {
            case .traditional: return model.t("sound_traditional")
            case .uniform: return model.t("sound_uniform")
            case .voice: return model.t("sound_voice")
            }
        }()
        return Button {
            model.setMode(mode)
        } label: {
            VStack(spacing: 4) {
                Text(icon).font(.system(size: 20))
                Text(label).font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(on ? Palette.coralDeep : Palette.fg2)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(on ? Palette.coralSoft : Palette.surface2)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(on ? Palette.coral.opacity(0.45) : Color.clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(MacaronPressStyle())
    }

    private func meterChip(_ bc: Int, _ bu: Int, _ caption: String) -> some View {
        let on = model.prefs.bc == bc && model.prefs.bu == bu
        return Button {
            model.setSignature(bc: bc, bu: bu)
        } label: {
            VStack(spacing: 2) {
                Text("\(bc)/\(bu)")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                Text(caption)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(on ? Palette.coralDeep.opacity(0.8) : Palette.muted)
            }
            .foregroundStyle(on ? Palette.coralDeep : Palette.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(on ? Palette.coralSoft : Palette.surface2)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(MacaronPressStyle())
    }

    private func stepperChip(_ label: String, value: Int, range: ClosedRange<Int>, set: @escaping (Int) -> Void) -> some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Palette.muted)
            Button { set(max(range.lowerBound, value - 1)) } label: {
                Text("−").font(.headline).frame(width: 28, height: 28)
                    .opacity(value > range.lowerBound ? 1 : 0.38)
            }
            .disabled(value <= range.lowerBound)
            .buttonStyle(MacaronPressStyle())
            Text("\(value)")
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .foregroundStyle(Palette.ink)
                .frame(minWidth: 22)
            Button { set(min(range.upperBound, value + 1)) } label: {
                Text("+").font(.headline).frame(width: 28, height: 28)
                    .opacity(value < range.upperBound ? 1 : 0.38)
            }
            .disabled(value >= range.upperBound)
            .buttonStyle(MacaronPressStyle())
        }
        .foregroundStyle(Palette.ink)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(Palette.surface2)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func langChip(_ title: String, _ code: String) -> some View {
        let on = model.prefs.lang == code
        return Button { model.setLang(code) } label: {
            Text(title)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(on ? Palette.coralDeep : Palette.fg2)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(on ? Palette.coralSoft : Palette.surface2)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(MacaronPressStyle())
    }

    private func settingToggle(_ title: String, on: Bool, set: @escaping (Bool) -> Void) -> some View {
        Toggle(isOn: Binding(get: { on }, set: set)) {
            Text(title)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Palette.ink)
        }
        .tint(Palette.coral)
        .padding(.vertical, 6)
    }

    private func hapticOptionRow(
        title: String,
        options: [(String, String)],
        current: String,
        unlocked: Bool,
        freeId: String,
        choose: @escaping (String) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Palette.muted)
            HStack(spacing: 8) {
                ForEach(options, id: \.0) { id, label in
                    let on = current == id
                    let packLocked = !unlocked && id != freeId
                    Button { choose(id) } label: {
                        HStack(spacing: 4) {
                            if packLocked {
                                Image(systemName: "lock.fill").font(.system(size: 9, weight: .bold))
                            }
                            Text(label)
                        }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(on ? Palette.coralDeep : Palette.fg2)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(on ? Palette.coralSoft : Palette.surface2)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(MacaronPressStyle())
                }
            }
        }
    }

    private func bankChips(title: String, voice: Bool) -> some View {
        let current = voice ? model.prefs.voiceBank : model.prefs.clickBank
        let banks = [MetronomePolicy.defaultBank] + (voice ? MetronomePolicy.packVoiceBanks : MetronomePolicy.packClickBanks)
        return VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Palette.muted)
            FlexibleChips(banks: banks, current: current, voice: voice)
        }
    }
}

private struct FlexibleChips: View {
    @EnvironmentObject var model: MetronomeModel
    let banks: [String]
    let current: String
    let voice: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(banks, id: \.self) { bank in
                chip(bank)
            }
        }
    }

    private func chip(_ bank: String) -> some View {
        let on = current == bank
        let locked = !model.unlocked && bank != MetronomePolicy.defaultBank
        return Button {
            if voice { model.requestVoiceBank(bank) } else { model.requestClickBank(bank) }
        } label: {
            HStack(spacing: 8) {
                Text(model.bankLabel(bank, voice: voice))
                    .font(.system(size: 14, weight: .semibold))
                Spacer()
                if locked {
                    Image(systemName: "lock.fill").font(.caption2)
                } else if on {
                    Image(systemName: "checkmark").font(.caption.weight(.bold))
                }
            }
            .foregroundStyle(on ? Palette.coralDeep : Palette.ink)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(on ? Palette.coralSoft : Palette.surface2)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(MacaronPressStyle())
    }
}
