#!/usr/bin/env python3
"""Tạo toàn bộ âm thanh của Sâm Dứa (tổng hợp bằng numpy, không dùng tài nguyên bên ngoài).
Xuất ra public/audio/<tên>.ogg và .mp3. Giọng đọc tiếng Việt dùng espeak-ng (nếu có).
Chạy: python3 scripts/make_audio.py
"""
import os, subprocess, tempfile, wave
import numpy as np
from scipy import signal

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def t_(d): return np.arange(int(SR * d)) / SR
def noise(d): return rng.standard_normal(int(SR * d))
def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], 'band'); return signal.lfilter(b, a, x)
def lp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'low'); return signal.lfilter(b, a, x)
def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'high'); return signal.lfilter(b, a, x)
def expenv(d, tau, att=0.002):
    t = t_(d); e = np.exp(-t / tau); a = int(att * SR)
    if a > 0: e[:a] *= np.linspace(0, 1, a)
    return e
def place(buf, x, at):
    i = int(at * SR); n = min(len(x), len(buf) - i)
    if n > 0: buf[i:i + n] += x[:n]
    return buf
def silence(d): return np.zeros(int(SR * d))
def norm(x, peak=0.89):
    m = np.max(np.abs(x)) or 1; return x / m * peak
def fade(x, fin=0.003, fout=0.02):
    x = x.copy(); a, b = int(fin * SR), int(fout * SR)
    if a: x[:a] *= np.linspace(0, 1, a)
    if b: x[-b:] *= np.linspace(1, 0, b)
    return x
def reverb(x, dur=0.8, mix=0.25, tone=4000):
    ir = noise(dur) * np.exp(-t_(dur) / (dur / 5)); ir = lp(ir, tone); ir /= np.sum(np.abs(ir)) / 6
    y = signal.fftconvolve(x, ir)[:len(x) + int(dur * SR * 0.6)]
    out = np.zeros(len(y)); out[:len(x)] += x * (1 - mix); out += y * mix
    return out
def tone(f, d, kind='sine', tau=None):
    t = t_(d)
    ph = 2 * np.pi * np.cumsum(np.broadcast_to(f, t.shape)) / SR if np.ndim(f) else 2 * np.pi * f * t
    if kind == 'sine': y = np.sin(ph)
    elif kind == 'tri': y = signal.sawtooth(ph, 0.5)
    elif kind == 'saw': y = signal.sawtooth(ph)
    elif kind == 'square': y = signal.square(ph)
    if tau: y *= expenv(d, tau)
    return y
def bell(f, d, tau=0.5, partials=((1, 1), (2.0, .5), (3.01, .25), (4.2, .12))):
    return sum(a * tone(f * r, d, tau=tau / (1 + r * .3)) for r, a in partials)
def adsr(n, a=.01, d=.05, s=.7, r=.1):
    e = np.ones(n) * s; A, D, R = int(a * SR), int(d * SR), int(r * SR)
    e[:A] = np.linspace(0, 1, A) if A else e[:A]
    e[A:A + D] = np.linspace(1, s, len(e[A:A + D]))
    if R: e[-R:] *= np.linspace(1, 0, R)
    return e
def brass(f, d, vib=0):
    t = t_(d); ff = f * (1 + vib * np.sin(2 * np.pi * 5.5 * t))
    y = tone(ff, d, 'saw'); y = lp(y, 2200) * adsr(len(y), .03, .1, .8, .12)
    return y

def card_flick(gain=1.0, d=0.05):
    x = bp(noise(d), 1800, 7000) * expenv(d, 0.008, 0.001)
    return x * gain
def card_slap(gain=1.0):
    d = 0.16
    x = bp(noise(d), 700, 6000) * expenv(d, 0.018, 0.0008)
    th = tone(np.linspace(170, 90, int(SR * d)), d) * expenv(d, 0.03)
    return (x + 0.6 * th) * gain
def wood(f=900, d=0.12):
    return (tone(f, d, tau=0.02) + 0.5 * tone(f * 2.7, d, tau=0.01) + 0.3 * bp(noise(d), f, f * 3) * expenv(d, 0.005))

S = {}
# ---- âm bài ----
S['select'] = fade(hp(card_flick(0.7, 0.04), 1500) + 0.2 * tone(2400, 0.04, tau=0.006))
buf = silence(0.55)
for k in range(6): place(buf, card_flick(0.9 - k * 0.05), 0.02 + k * 0.075)
S['deal'] = fade(buf)
buf = silence(1.0)
ts = np.cumsum(np.linspace(0.04, 0.012, 45)); ts = ts / ts[-1] * 0.8
for k, tt in enumerate(ts): place(buf, card_flick(0.35 + 0.4 * k / 45, 0.03), tt)
place(buf, bp(noise(0.25), 600, 3000) * expenv(0.25, 0.06) * 0.6, 0.78)
S['shuffle'] = fade(buf)
S['play'] = fade(reverb(card_slap(), 0.35, 0.12))
buf = silence(0.4); place(buf, card_slap(0.8), 0); place(buf, card_slap(1.0), 0.06)
S['play_big'] = fade(reverb(buf, 0.4, 0.15))
S['place'] = fade(lp(card_slap(0.7), 2500))
buf = silence(0.4); place(buf, wood(260, 0.15), 0); place(buf, wood(260, 0.15) * 0.8, 0.13)
S['pass'] = fade(reverb(buf, 0.3, 0.1))
d = 0.45; sweep = noise(d); sweep = np.concatenate([bp(sweep[i:i + 2205], 400 + i / len(sweep) * 4000, 1200 + i / len(sweep) * 6000) for i in range(0, len(sweep), 2205)])
S['collect'] = fade(sweep[:int(SR * d)] * np.sin(np.pi * t_(d) / d) ** 1.5 * 0.7)
S['turn'] = fade(wood(1300, 0.1) * 0.5)
buf = silence(0.9); place(buf, bell(1318, 0.8, 0.35), 0); place(buf, bell(1976, 0.7, 0.3) * 0.8, 0.12)
S['myturn'] = fade(buf * 0.6)
buf = silence(0.5)
for k in range(3): place(buf, tone(988, 0.08, 'tri') * adsr(int(0.08 * SR), .003, .02, .8, .02), k * 0.15)
S['warn5'] = fade(buf)

# ---- chặt ----
def impact(boom=60, crack=1.0, metal=1.0, d=0.9):
    t = t_(d)
    b = np.sin(2 * np.pi * np.cumsum(np.linspace(boom, boom * 0.55, len(t))) / SR) * expenv(d, 0.18)
    c = hp(noise(d), 1500) * expenv(d, 0.02, 0.0005) * crack
    m = sum(a * tone(f, d, tau=0.25) for f, a in ((523, .5), (1397, .35), (2211, .25), (3460, .15))) * metal
    return b * 1.2 + c * 0.8 + m * 0.5
def riser(d=0.35):
    t = t_(d); x = noise(d)
    out = np.concatenate([bp(x[i:i + 1100], 300 + 5000 * (i / len(x)) ** 2, 800 + 9000 * (i / len(x)) ** 2) for i in range(0, len(x), 1100)])[:len(t)]
    return out * (t / d) ** 2
S['chop2'] = fade(reverb(impact(), 1.0, 0.25), fout=0.1)
buf = silence(1.4); place(buf, riser(0.3) * 0.6, 0); place(buf, impact(55, 1.0, 1.2), 0.3); place(buf, impact(80, 0.6, 0.8) * 0.7, 0.48)
S['chopde'] = fade(reverb(buf, 1.1, 0.28), fout=0.15)
buf = silence(1.7); place(buf, riser(0.45) * 0.7, 0)
for k, (f, g) in enumerate(((50, 1.0), (70, .8), (95, .9))): place(buf, impact(f, 1.0, 1.3) * g, 0.45 + k * 0.16)
S['chopde2'] = fade(reverb(buf, 1.3, 0.3), fout=0.2)

# ---- Sâm ----
def gong(f=98, d=2.2):
    parts = ((1, 1), (1.47, .6), (2.09, .5), (2.56, .4), (3.24, .3), (4.7, .2))
    y = sum(a * tone(f * r * (1 + 0.003 * np.sin(2 * np.pi * 3 * t_(d))), d, tau=0.9 / (1 + r * 0.2)) for r, a in parts)
    return y + hp(noise(d), 800) * expenv(d, 0.05) * 0.3
S['bao_sam'] = fade(reverb(gong(), 1.2, 0.3), fout=0.3)
buf = silence(1.4); place(buf, impact(65, 1.2, 0.6), 0)
for k, f in enumerate((392, 370, 349)): place(buf, brass(f, 0.18) * 0.5, 0.25 + k * 0.17)
S['bat_sam'] = fade(reverb(buf, 0.8, 0.2), fout=0.2)
buf = silence(1.7)
for k, f in enumerate((523, 659, 784, 1047)):
    place(buf, brass(f, 0.22 if k < 3 else 0.9) * 0.45, k * 0.13); place(buf, bell(f * 2, 0.6, 0.3) * 0.15, k * 0.13)
S['sam_win'] = fade(reverb(buf, 1.0, 0.25), fout=0.2)
buf = silence(1.9)
for k, f in enumerate((311, 294, 277)): place(buf, brass(f, 0.35, 0) * 0.5, k * 0.38)
place(buf, brass(262, 0.8, 0.02) * 0.5, 1.14)
S['sam_fail'] = fade(reverb(buf, 0.6, 0.15), fout=0.2)
d = 0.7; f = 180 + 120 * np.sin(2 * np.pi * 9 * t_(d)) * np.exp(-t_(d) * 4) + np.linspace(220, 120, int(SR * d))
S['cong'] = fade(tone(f, d, 'tri') * expenv(d, 0.3) * 0.7)
d = 0.8; f = np.linspace(1500, 260, int(SR * d))
S['thoi2'] = fade((tone(f, d, 'sine') * 0.5 + bp(noise(d), 500, 2500) * 0.15) * np.linspace(1, 0.2, int(SR * d)))

# ---- thắng / thua / thông báo ----
def chord(freqs, d, tau=0.8, gain=0.25): return sum(bell(f, d, tau) for f in freqs) * gain
buf = silence(2.8)
for k, f in enumerate((523, 659, 784, 1047, 1319)): place(buf, bell(f, 0.9, 0.35) * 0.4, k * 0.09)
place(buf, chord((523, 659, 784, 1047), 2.0, 0.9, 0.22), 0.55)
place(buf, brass(523, 1.2) * 0.25, 0.55); place(buf, brass(784, 1.2) * 0.2, 0.55)
S['win'] = fade(reverb(buf, 1.4, 0.3), fout=0.4)
buf = silence(2.2)
for k, f in enumerate((440, 415, 392, 349)): place(buf, bell(f, 0.9, 0.4) * 0.35, k * 0.28)
place(buf, chord((220, 262, 330), 1.2, 0.8, 0.2), 1.1)
S['lose'] = fade(reverb(buf, 1.2, 0.3), fout=0.4)
S['notify'] = fade(reverb(bell(1568, 0.5, 0.2) * 0.5, 0.5, 0.2))
buf = silence(0.7); place(buf, bell(784, 0.5, 0.25) * .5, 0); place(buf, bell(523, 0.5, 0.25) * .5, 0.16)
S['pause'] = fade(reverb(buf, 0.6, 0.2))
buf = silence(0.7); place(buf, bell(523, 0.5, 0.25) * .5, 0); place(buf, bell(784, 0.5, 0.25) * .5, 0.16)
S['resume'] = fade(reverb(buf, 0.6, 0.2))
d = 0.3; S['disconnect'] = fade(tone(np.linspace(700, 300, int(SR * d)), d, 'sine') * expenv(d, 0.12) * 0.5)
S['reconnect'] = fade(tone(np.linspace(400, 900, int(SR * d)), d, 'sine') * expenv(d, 0.12) * 0.5)
S['end'] = fade(reverb(bell(880, 1.4, 0.6, ((1, 1), (2.76, .4), (5.4, .2))) * 0.6, 1.0, 0.3), fout=0.3)
buf = silence(0.8)
for k, f in enumerate((659, 784, 988)): place(buf, bell(f, 0.5, 0.25) * 0.35, k * 0.08)
S['start'] = fade(reverb(buf, 0.7, 0.25))
d = 0.45; x = noise(d); S['phase'] = fade(np.concatenate([bp(x[i:i + 1100], 300 + 3000 * (i / len(x)), 900 + 6000 * (i / len(x))) for i in range(0, len(x), 1100)])[:int(SR * d)] * np.sin(np.pi * t_(d) / d) * 0.5)
buf = silence(0.8)
for k in range(9):
    f0 = rng.uniform(2500, 5200)
    place(buf, (tone(f0, 0.12, tau=0.03) + 0.6 * tone(f0 * 1.51, 0.12, tau=0.02)) * rng.uniform(.3, .6), k * rng.uniform(0.04, 0.08))
S['coins'] = fade(reverb(buf, 0.4, 0.15))

# ---- nhạc nền lounge (vòng lặp liền mạch) ----
def music_loop():
    bpm = 88; beat = 60 / bpm; bars = 8; L = int(SR * beat * 4 * bars)
    out = np.zeros((L + SR * 3, 2))
    prog = [  # (bass notes, chord voicing)
        ([146.8, 174.6, 196.0, 220.0], [261.6, 349.2, 440.0, 523.3]),   # Dm9
        ([196.0, 246.9, 293.7, 246.9], [246.9, 349.2, 440.0, 659.3]),   # G13
        ([130.8, 164.8, 196.0, 246.9], [246.9, 329.6, 392.0, 587.3]),   # Cmaj9
        ([110.0, 138.6, 164.8, 196.0], [277.2, 392.0, 466.2, 554.4]),   # A7b9
    ]
    def ep(f, d):  # electric piano
        t = t_(d)
        y = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6) + 0.1 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 9)
        return y * np.exp(-t * 1.2) * (1 + 0.15 * np.sin(2 * np.pi * 4.5 * t))
    def bass(f, d):
        t = t_(d); y = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
        return lp(y, 600) * adsr(len(t), .01, .1, .6, .08)
    def hat(d=0.09, g=0.2): return hp(noise(d), 7000) * expenv(d, 0.02) * g
    def brush(d=0.3, g=0.08): return bp(noise(d), 2000, 9000) * np.sin(np.pi * t_(d) / d) * g
    for bar in range(bars):
        bs, ch = prog[(bar // 2) % 4]
        t0 = bar * 4 * beat
        for k, f in enumerate(bs):            # walking bass
            y = bass(f / 2 if f > 180 else f, beat * 0.95) * 0.5
            i = int((t0 + k * beat) * SR); out[i:i + len(y), 0] += y; out[i:i + len(y), 1] += y
        hits = [0, 1.5, 2.5] if bar % 2 == 0 else [0.5, 2, 3.5]
        for hb in hits:                       # comping
            for j, f in enumerate(ch):
                y = ep(f, beat * 2.2) * 0.09
                i = int((t0 + hb * beat + j * 0.012) * SR); pan = 0.35 + j * 0.1
                out[i:i + len(y), 0] += y * (1 - pan); out[i:i + len(y), 1] += y * pan
        for k in range(4):                    # trống chổi, swing
            for off, g in ((0, 0.22), (2 / 3, 0.12)):
                y = hat(g=g * 0.5); i = int((t0 + (k + off) * beat) * SR)
                out[i:i + len(y), 0] += y * 0.6; out[i:i + len(y), 1] += y
            y = brush(); i = int((t0 + k * beat) * SR); out[i:i + len(y), 0] += y; out[i:i + len(y), 1] += y * 0.7
    tail = out[L:].copy(); out = out[:L]; out[:len(tail)] += tail[:L]   # cuộn đuôi về đầu: lặp liền mạch
    for c in range(2): out[:, c] = lp(out[:, c], 7000)
    return out / np.max(np.abs(out)) * 0.8

def ambient_loop(d=16.0):
    n = int(SR * d)
    pink = signal.lfilter([0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400], rng.standard_normal(n + SR))
    room = lp(pink, 500)[:n] * 0.5
    out = np.zeros((n + SR, 2))
    out[:n, 0] += room; out[:n, 1] += np.roll(room, 2000)
    for k in range(14):                       # tiếng rì rầm xa
        dd = rng.uniform(0.6, 1.5); x = bp(noise(dd), rng.uniform(250, 500), rng.uniform(900, 1600)) * np.sin(np.pi * t_(dd) / dd) ** 2 * 0.12
        i = int(rng.uniform(0, d - dd) * SR); p = rng.uniform(.2, .8)
        out[i:i + len(x), 0] += x * (1 - p); out[i:i + len(x), 1] += x * p
    for k in range(10):                       # tiếng chip va nhau
        f0 = rng.uniform(3000, 5000); x = (tone(f0, 0.08, tau=0.02) + 0.5 * tone(f0 * 1.4, 0.08, tau=0.015)) * 0.05
        i = int(rng.uniform(0, d - 0.1) * SR); p = rng.uniform(.1, .9)
        out[i:i + len(x), 0] += x * (1 - p); out[i:i + len(x), 1] += x * p
    tail = out[n:].copy(); out = out[:n]; out[:len(tail)] += tail
    xf = int(SR * 0.5)                        # crossfade đầu-cuối
    out[:xf] = out[:xf] * np.linspace(0, 1, xf)[:, None] + out[-xf:] * np.linspace(1, 0, xf)[:, None]
    out = out[:-xf]
    return out / np.max(np.abs(out)) * 0.6

def write_wav(path, x):
    x = np.asarray(x)
    if x.ndim == 1: x = x[:, None]
    data = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())

def encode(name, wav, stereo=False, long=False):
    br = '96k' if long else '64k'
    q = '3' if long else '2'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libvorbis', '-q:a', q, os.path.join(OUT, name + '.ogg')], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', br, os.path.join(OUT, name + '.mp3')], check=True)

# Giọng đọc thu sẵn (ElevenLabs) nằm trong assets/voice/<tên>.mp3 — luôn được ưu tiên.
VOICE_SRC = os.path.join(os.path.dirname(__file__), '..', 'assets', 'voice')
# Câu chưa có bản thu thì đọc tạm bằng espeak-ng (giọng máy).
VOICES = {}

def encode_recorded(name, src):
    # cắt khoảng lặng đầu/cuối, chuẩn hoá độ lớn về cùng mức, mono 44.1k
    af = ('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,'
          'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,'
          'loudnorm=I=-16:TP=-1.5:LRA=11')
    for ext, codec in (('ogg', ['-c:a', 'libvorbis', '-q:a', '4']), ('mp3', ['-c:a', 'libmp3lame', '-b:a', '96k'])):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', af, '-ac', '1', '-ar', str(SR)] + codec + [os.path.join(OUT, name + '.' + ext)], check=True)

def main():
    with tempfile.TemporaryDirectory() as td:
        for name, x in S.items():
            p = os.path.join(td, name + '.wav'); write_wav(p, norm(x, 0.85)); encode(name, p)
        p = os.path.join(td, 'music.wav'); write_wav(p, music_loop()); encode('music', p, True, True)
        p = os.path.join(td, 'ambient.wav'); write_wav(p, ambient_loop()); encode('ambient', p, True, True)
        # Hai bộ giọng thu sẵn: assets/voice/f/<câu>.mp3 (Nữ) và assets/voice/m/<câu>.mp3 (Nam)
        # -> public/audio/f_<câu>.*, m_<câu>.* và voices.json liệt kê câu nào bộ nào có.
        import json, re
        recorded = set()
        manifest = {'f': [], 'm': []}
        for pack in ('f', 'm'):
            d = os.path.join(VOICE_SRC, pack)
            if not os.path.isdir(d): continue
            for f in sorted(os.listdir(d)):
                m = re.match(r'^([a-z0-9]+)\.(mp3|wav|m4a|ogg)$', f)
                if not m: continue
                name = f'{pack}_{m.group(1)}'
                encode_recorded(name, os.path.join(d, f))
                manifest[pack].append(m.group(1)); recorded.add(name)
        with open(os.path.join(OUT, 'voices.json'), 'w') as fh:
            json.dump(manifest, fh, ensure_ascii=False)
        if subprocess.run(['which', 'espeak-ng'], capture_output=True).returncode == 0:
            for name, text in VOICES.items():
                if name in recorded: continue
                raw = os.path.join(td, name + '_raw.wav')
                subprocess.run(['espeak-ng', '-v', 'vi', '-s', '150', '-p', '42', '-a', '180', '-w', raw, text], check=True)
                with wave.open(raw) as w:
                    sr = w.getframerate(); y = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(float) / 32768
                y = signal.resample_poly(y, SR, sr)
                y = lp(hp(y, 120), 7000)
                y = fade(norm(y, 0.8), 0.005, 0.03)
                p = os.path.join(td, name + '.wav'); write_wav(p, reverb(y, 0.25, 0.08)); encode(name, p)
        else:
            print('Không có espeak-ng: bỏ qua giọng đọc')
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print('Đã tạo', len(os.listdir(OUT)), 'file,', round(total / 1024), 'KB')

if __name__ == '__main__':
    main()
