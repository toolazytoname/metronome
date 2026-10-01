#!/bin/bash
# 同步免费采样树到鸿蒙 rawfile（WAV，mono 44.1k s16le，免运行时 mp3 解码）+ 收款码 + 图标。
# 不带 pack/（cn 变体不卖包）。需 ffmpeg。
set -e
cd "$(dirname "$0")/.."
S=assets/sounds
D=harmony/entry/src/main/resources/rawfile/sounds
mkdir -p $D/voice/zh $D/voice/en harmony/entry/src/main/resources/base/media harmony/AppScope/resources/base/media
for f in click-strong click-weak click-uniform; do
  ffmpeg -y -loglevel error -i $S/$f.mp3 -ac 1 -ar 44100 -c:a pcm_s16le $D/$f.wav
done
for L in zh en; do
  for i in $(seq -w 1 16); do
    ffmpeg -y -loglevel error -i $S/voice/$L/$i.mp3 -ac 1 -ar 44100 -c:a pcm_s16le $D/voice/$L/$i.wav
  done
done
cp images/qr-wechat.jpg images/qr-alipay.jpg harmony/entry/src/main/resources/rawfile/
cp images/bunny.png harmony/entry/src/main/resources/base/media/app_icon.png
cp images/bunny.png harmony/AppScope/resources/base/media/app_icon.png
echo "harmony rawfile synced: $(du -sh $D | cut -f1)"
