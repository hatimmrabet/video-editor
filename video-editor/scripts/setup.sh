#!/bin/bash
# فحص وتجهيز الأدوات — يشتغل على macOS · Windows (Git-Bash) · Linux.
#   ./setup.sh            → يفحص ويقول وش ناقص
#   ./setup.sh --install  → ينزّل الناقص (بعد إذن المستخدم)
. "$(dirname "$0")/lib/platform.sh"
INSTALL=0; [ "$1" = "--install" ] && INSTALL=1
MISS=(); OK=(); NOTE=()
have(){ command -v "$1" >/dev/null 2>&1; }
line(){ printf '%s\n' "$1"; }
pyhas(){ python3 -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$1') else 1)" 2>/dev/null; }

line "النظام: $VEVO_OS"

have ffmpeg  && OK+=("ffmpeg")  || MISS+=("ffmpeg")
have node    && OK+=("node")    || MISS+=("node")
pyhas numpy  && OK+=("numpy")   || MISS+=("numpy")

# محرّك التفريغ: faster-whisper (مفضّل) أو openai-whisper — واحد يكفي
if   pyhas faster_whisper; then OK+=("faster-whisper")
elif pyhas whisper;        then OK+=("whisper");  NOTE+=("faster-whisper أسرع بكثير — pip install faster-whisper")
else MISS+=("transcriber"); fi

# كروم
CHROME="$(vevo_chrome_path)"
[ -n "$CHROME" ] && OK+=("chrome") || MISS+=("chrome")

# puppeteer-core
node -e "require.resolve('puppeteer-core')" 2>/dev/null && OK+=("puppeteer-core") || MISS+=("puppeteer-core")

# GPU (تسريع اختياري للتفريغ)
if have nvidia-smi; then
  if pyhas nvidia.cudnn && pyhas nvidia.cublas; then line "🎮 GPU NVIDIA + مكتبات CUDA → التفريغ على الكرت (الأسرع)"
  else NOTE+=("عندك GPU NVIDIA — للتفريغ عليه: pip install nvidia-cublas-cu12 nvidia-cudnn-cu12"); fi
fi

line "الجاهز: ${OK[*]:-لا شيء}"
if have npm; then line "المحرّك الثاني (ريموشن): متاح عند الطلب — remotion/remotion.sh setup ينزّله (~500 ميقا)"
else line "المحرّك الثاني (ريموشن): يحتاج npm — غير متاح، والخفيف يكفي"; fi

if [ ${#MISS[@]} -eq 0 ]; then
  [ ${#NOTE[@]} -gt 0 ] && printf 'ℹ️  %s\n' "${NOTE[@]}"
  line "✅ كل شي جاهز — نقدر نبدأ."; exit 0
fi
line "الناقص: ${MISS[*]}"
[ $INSTALL -eq 0 ] && { line "شغّل: $0 --install"; exit 10; }

PKG="$(vevo_pkg_mgr)"
sys_install(){   # $1 = اسم الأداة
  case "$PKG:$1" in
    brew:*)        brew install "$1" ;;
    winget:ffmpeg) winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements --disable-interactivity ;;
    winget:node)   winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --disable-interactivity ;;
    apt:*)         sudo apt-get update -qq && sudo apt-get install -y "$1" ;;
    dnf:*)         sudo dnf install -y "$1" ;;
    *)             return 1 ;;
  esac
}
pip_install(){ pip3 install --quiet "$@" || pip3 install --quiet --break-system-packages "$@"; }

for m in "${MISS[@]}"; do
  case "$m" in
    ffmpeg|node)
      line "⏬ $m…"
      sys_install "$m" || NOTE+=("$m: نزّله يدوياً ($PKG غير متاح — brew / winget / apt)") ;;
    numpy)         line "⏬ numpy…";          pip_install numpy || NOTE+=("numpy فشل") ;;
    transcriber)   line "⏬ faster-whisper… (الموديل ينزل أول تشغيل)"
                   pip_install faster-whisper || NOTE+=("faster-whisper فشل — جرّب: pip install openai-whisper") ;;
    puppeteer-core) line "⏬ puppeteer-core…"; npm i --silent puppeteer-core || NOTE+=("puppeteer-core فشل") ;;
    chrome)        NOTE+=("كروم مو منصّب — نزّله من google.com/chrome أو حدّد CHROME_PATH") ;;
  esac
done

FAIL=0
have ffmpeg || FAIL=1
{ pyhas faster_whisper || pyhas whisper; } || FAIL=1
pyhas numpy || FAIL=1
[ -n "$(vevo_chrome_path)" ] || FAIL=1
node -e "require.resolve('puppeteer-core')" 2>/dev/null || FAIL=1
[ ${#NOTE[@]} -gt 0 ] && printf '⚠️  %s\n' "${NOTE[@]}"
[ $FAIL -eq 0 ] && line "✅ كل شي جاهز الحين." || { line "❌ باقي ناقص — شوف الملاحظات فوق."; exit 11; }
