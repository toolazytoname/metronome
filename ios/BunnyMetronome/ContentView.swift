import SwiftUI

struct ContentView: View {
    @EnvironmentObject var model: MetronomeModel

    var body: some View {
        ZStack {
            Color(red: 1.0, green: 0.965, blue: 0.933).ignoresSafeArea()
            VStack(spacing: 20) {
                HStack {
                    Text(model.t("app_name"))
                        .font(.headline)
                    Spacer()
                    Button(model.t("settings")) { model.settingsOpen = true }
                }
                .padding(.horizontal)

                Text("\(model.prefs.bpm)")
                    .font(.system(size: 88, weight: .bold, design: .rounded))
                    .foregroundStyle(Color(red: 0.88, green: 0.42, blue: 0.38))
                Text("BPM")
                    .foregroundStyle(.secondary)

                HStack(spacing: 10) {
                    ForEach(0..<model.prefs.bc, id: \.self) { i in
                        Circle()
                            .fill(i == model.activeBeat
                                  ? Color(red: 0.88, green: 0.42, blue: 0.38)
                                  : Color.white)
                            .frame(width: 28, height: 28)
                            .overlay(Circle().stroke(Color(red: 0.9, green: 0.8, blue: 0.75)))
                    }
                }
                .padding(.vertical, 8)

                HStack {
                    Button("−") { model.setBpm(model.prefs.bpm - 1) }
                        .frame(width: 44, height: 44)
                    Slider(
                        value: Binding(
                            get: { Double(model.prefs.bpm) },
                            set: { model.setBpm(Int($0.rounded())) }
                        ),
                        in: 40...208, step: 1
                    )
                    Button("+") { model.setBpm(model.prefs.bpm + 1) }
                        .frame(width: 44, height: 44)
                }
                .padding(.horizontal)

                Button {
                    model.togglePlay()
                } label: {
                    Text(model.playing ? model.t("pause") : model.t("play"))
                        .font(.title2.bold())
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(red: 0.88, green: 0.42, blue: 0.38))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                }
                .padding(.horizontal)
                .padding(.top, 8)
            }
            .padding(.vertical)
        }
        .sheet(isPresented: $model.settingsOpen) {
            SettingsView()
                .environmentObject(model)
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject var model: MetronomeModel

    var body: some View {
        NavigationStack {
            Form {
                Section(model.t("time_signature")) {
                    let presets = [(4, 4), (3, 4), (2, 4), (6, 8), (5, 4), (7, 8)]
                    ForEach(presets, id: \.0) { pair in
                        Button("\(pair.0)/\(pair.1)") {
                            model.setSignature(bc: pair.0, bu: pair.1)
                        }
                    }
                    HStack {
                        Stepper("beats \(model.prefs.bc)", value: Binding(
                            get: { model.prefs.bc },
                            set: { model.setSignature(bc: $0, bu: model.prefs.bu) }
                        ), in: 1...16)
                    }
                }
                Section {
                    Picker(model.t("sound_traditional"), selection: Binding(
                        get: { model.prefs.mode },
                        set: { model.setMode($0) }
                    )) {
                        Text(model.t("sound_traditional")).tag(SoundMode.traditional)
                        Text(model.t("sound_uniform")).tag(SoundMode.uniform)
                        Text(model.t("sound_voice")).tag(SoundMode.voice)
                    }
                    .pickerStyle(.segmented)
                }
                Section(model.t("volume")) {
                    Slider(value: Binding(
                        get: { Double(model.prefs.vol) },
                        set: { model.prefs.vol = MetronomePolicy.clampVolume(Int($0.rounded())); model.applyAudioSettings() }
                    ), in: 10...100)
                }
                Section(model.t("language")) {
                    Picker("lang", selection: Binding(
                        get: { model.prefs.lang },
                        set: { model.setLang($0) }
                    )) {
                        Text("中文").tag("zh")
                        Text("English").tag("en")
                    }
                    .pickerStyle(.segmented)
                }
                Toggle(model.t("haptic"), isOn: Binding(
                    get: { model.prefs.haptic },
                    set: { model.prefs.haptic = $0; model.applyAudioSettings() }
                ))
                Toggle(model.t("keep_awake"), isOn: Binding(
                    get: { model.prefs.keepAwake },
                    set: { model.prefs.keepAwake = $0; model.persist() }
                ))
                Section(model.t("sound_workshop")) {
                    Text(model.t("sound_workshop_blurb"))
                        .font(.footnote)
                    if model.unlocked {
                        Text(model.t("owned"))
                        ForEach(MetronomePolicy.packClickBanks, id: \.self) { bank in
                            Button(bank) { model.requestClickBank(bank) }
                        }
                        ForEach(MetronomePolicy.packVoiceBanks, id: \.self) { bank in
                            Button(bank) { model.requestVoiceBank(bank) }
                        }
                        Button("default") {
                            model.requestClickBank("default")
                            model.requestVoiceBank("default")
                        }
                    } else {
                        Button(model.t("buy")) {
                            Task { await model.buyPack() }
                        }
                    }
                    Button(model.t("restore")) {
                        Task { await model.restorePurchases() }
                    }
                }
            }
            .navigationTitle(model.t("settings"))
        }
    }
}
