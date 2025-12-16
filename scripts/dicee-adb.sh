#!/usr/bin/env bash
# Dicee ADB Helper - Android device testing utilities
# Works with bash/zsh
#
# Installation:
#   chmod +x scripts/dicee-adb.sh
#   # Add to ~/.zshrc or ~/.bashrc:
#   alias dicee-adb="/path/to/dicee/scripts/dicee-adb.sh"
#
# Or add to PATH:
#   ln -s /path/to/dicee/scripts/dicee-adb.sh /usr/local/bin/dicee-adb

set -e

LOG_DIR="$HOME/Desktop/dicee-logs"
PID_FILE="/tmp/dicee-adb-capture.pid"
LOG_FILE_REF="/tmp/dicee-adb-capture.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
    cat << 'EOF'
🎲 Dicee ADB Helper - Android Testing Utilities

Usage: dicee-adb <command> [args]

Commands:
  status              Check device connection status
  logs [filter]       Stream Chrome/WebView logs
                      Default filter: chromium:D
                      Example: dicee-adb logs 'chromium:V'
  capture [name]      Start named log capture session
                      Saves to ~/Desktop/dicee-logs/
  stop                Stop active capture session
  ports [port]        Setup port forwarding (default: 3000,5173,8787,54321)
  clear               Clear all port forwarding
  bugreport [name]    Generate full device bug report
  inspect             Open Chrome remote debugging page
  screenshot [name]   Capture device screenshot
  shell               Open ADB shell on device
  restart             Restart ADB server
  help                Show this help message

Examples:
  dicee-adb status
  dicee-adb logs
  dicee-adb capture feature-test
  dicee-adb ports
  dicee-adb bugreport ws-issue

Log directory: ~/Desktop/dicee-logs/

For web debugging, use Chrome:
  1. Connect device
  2. Open Chrome on device, load your app
  3. Run: dicee-adb inspect
  4. Click 'inspect' next to your tab
EOF
}

cmd_status() {
    echo "🔍 Checking ADB connection..."
    echo ""

    # Check if ADB is installed
    if ! command -v adb &> /dev/null; then
        echo -e "${RED}❌ ADB not found. Install with: brew install android-platform-tools${NC}"
        exit 1
    fi

    adb_version=$(adb --version | head -1)
    echo "📦 $adb_version"
    echo ""

    # Get connected devices
    devices=$(adb devices -l 2>/dev/null)
    device_count=$(echo "$devices" | tail -n +2 | grep -v "^$" | wc -l | tr -d ' ')

    echo "📱 Connected devices: $device_count"
    echo ""

    if [ "$device_count" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No devices connected${NC}"
        echo ""
        echo "Troubleshooting:"
        echo "  1. Connect device via USB"
        echo "  2. Enable Developer Options on device"
        echo "  3. Enable USB Debugging on device"
        echo "  4. Check System Settings > Privacy & Security on Mac"
        echo "  5. Run: dicee-adb restart"
        exit 1
    fi

    # Show device details
    echo "$devices" | tail -n +2 | while read -r line; do
        if [ -n "$line" ]; then
            serial=$(echo "$line" | awk '{print $1}')
            state=$(echo "$line" | awk '{print $2}')
            model=$(echo "$line" | grep -o 'model:[^ ]*' | cut -d: -f2 || true)
            device=$(echo "$line" | grep -o 'device:[^ ]*' | cut -d: -f2 || true)

            if [ "$state" = "device" ]; then
                echo -e "  ${GREEN}✅ $serial${NC}"
                [ -n "$model" ] && echo "     Model: $model"
                [ -n "$device" ] && echo "     Device: $device"
            elif [ "$state" = "unauthorized" ]; then
                echo -e "  ${YELLOW}⚠️  $serial (unauthorized - check device for prompt)${NC}"
            else
                echo -e "  ${RED}❌ $serial ($state)${NC}"
            fi
        fi
    done

    # Show port forwarding status
    echo ""
    echo "🔌 Port forwarding:"
    forwards=$(adb reverse --list 2>/dev/null || true)
    if [ -n "$forwards" ]; then
        echo "$forwards" | while read -r line; do
            echo "  $line"
        done
    else
        echo "  None configured (run: dicee-adb ports)"
    fi
}

cmd_logs() {
    local filter="${1:-chromium:D}"

    echo "📋 Streaming logs with filter: $filter *:S"
    echo "   Press Ctrl+C to stop"
    echo ""

    # Clear buffer first
    adb logcat -c 2>/dev/null || true

    # Stream with color
    adb logcat -v color "$filter" '*:S'
}

cmd_capture() {
    local session_name="${1:-capture}"

    # Create log directory
    local today_dir="$LOG_DIR/$(date +%Y-%m-%d)"
    mkdir -p "$today_dir"

    local timestamp=$(date +%H%M%S)
    local log_file="$today_dir/$session_name-$timestamp.log"

    # Check for existing capture
    if [ -f "$PID_FILE" ]; then
        local existing_pid=$(cat "$PID_FILE")
        if kill -0 "$existing_pid" 2>/dev/null; then
            echo -e "${YELLOW}⚠️  Capture already running (PID: $existing_pid)${NC}"
            echo "   Stop with: dicee-adb stop"
            exit 1
        fi
    fi

    echo "📹 Starting capture session: $session_name"
    echo "   Output: $log_file"
    echo ""

    # Clear buffer
    adb logcat -c 2>/dev/null || true

    # Start capture in background
    adb logcat chromium:D WebView:D '*:E' > "$log_file" &
    local capture_pid=$!

    # Save PID and session info
    echo "$capture_pid" > "$PID_FILE"
    echo "$log_file" > "$LOG_FILE_REF"

    echo -e "${GREEN}✅ Capture started (PID: $capture_pid)${NC}"
    echo "   Stop with: dicee-adb stop"
    echo ""
    echo "   Tail logs: tail -f $log_file"
}

cmd_stop() {
    if [ ! -f "$PID_FILE" ]; then
        echo -e "${YELLOW}⚠️  No active capture session${NC}"
        exit 1
    fi

    local capture_pid=$(cat "$PID_FILE")
    local log_file=$(cat "$LOG_FILE_REF" 2>/dev/null || true)

    if kill -0 "$capture_pid" 2>/dev/null; then
        kill "$capture_pid" 2>/dev/null || true
        echo "⏹️  Stopped capture (PID: $capture_pid)"
    else
        echo -e "${YELLOW}⚠️  Capture process not running${NC}"
    fi

    rm -f "$PID_FILE" "$LOG_FILE_REF"

    if [ -n "$log_file" ] && [ -f "$log_file" ]; then
        local line_count=$(wc -l < "$log_file" | tr -d ' ')
        local file_size=$(du -h "$log_file" | cut -f1)
        echo ""
        echo "📄 Log file: $log_file"
        echo "   Lines: $line_count"
        echo "   Size: $file_size"
    fi
}

cmd_ports() {
    local custom_port="$1"

    echo "🔌 Setting up port forwarding..."
    echo ""

    # Default ports for Dicee development
    local ports=(3000 5173 8787 54321 54323)

    if [ -n "$custom_port" ]; then
        ports=("$custom_port")
    fi

    for port in "${ports[@]}"; do
        if adb reverse tcp:"$port" tcp:"$port" 2>/dev/null; then
            echo -e "  ${GREEN}✅ tcp:$port → localhost:$port${NC}"
        else
            echo -e "  ${RED}❌ Failed to forward port $port${NC}"
        fi
    done

    echo ""
    echo "Your device can now access:"
    echo "  http://localhost:3000  (SvelteKit)"
    echo "  http://localhost:5173  (Vite)"
    echo "  http://localhost:8787  (Wrangler DO)"
    echo "  http://localhost:54321 (Supabase API)"
}

cmd_clear() {
    echo "🔌 Clearing port forwarding..."
    adb reverse --remove-all 2>/dev/null || true
    echo -e "${GREEN}✅ Port forwarding cleared${NC}"
}

cmd_bugreport() {
    local name="${1:-bugreport}"

    local today_dir="$LOG_DIR/$(date +%Y-%m-%d)"
    mkdir -p "$today_dir"

    local timestamp=$(date +%H%M%S)
    local output_file="$today_dir/$name-$timestamp.zip"

    echo "🐛 Generating bug report..."
    echo "   This may take 1-2 minutes..."
    echo ""

    adb bugreport "$output_file"

    if [ -f "$output_file" ]; then
        local file_size=$(du -h "$output_file" | cut -f1)
        echo ""
        echo -e "${GREEN}✅ Bug report saved: $output_file${NC}"
        echo "   Size: $file_size"
    else
        echo -e "${RED}❌ Failed to generate bug report${NC}"
        exit 1
    fi
}

cmd_inspect() {
    echo "🔍 Opening Chrome DevTools Remote Debugging..."
    open "chrome://inspect/#devices"
}

cmd_screenshot() {
    local name="${1:-screenshot}"

    local today_dir="$LOG_DIR/$(date +%Y-%m-%d)"
    mkdir -p "$today_dir"

    local timestamp=$(date +%H%M%S)
    local output_file="$today_dir/$name-$timestamp.png"

    echo "📸 Capturing screenshot..."

    adb exec-out screencap -p > "$output_file"

    if [ -f "$output_file" ] && [ -s "$output_file" ]; then
        echo -e "${GREEN}✅ Screenshot saved: $output_file${NC}"
        open "$output_file"
    else
        echo -e "${RED}❌ Failed to capture screenshot${NC}"
        rm -f "$output_file"
        exit 1
    fi
}

cmd_restart() {
    echo "🔄 Restarting ADB server..."

    adb kill-server 2>/dev/null || true
    sleep 1
    adb start-server 2>/dev/null || true

    echo -e "${GREEN}✅ ADB server restarted${NC}"
    echo ""

    cmd_status
}

# Main command router
case "${1:-help}" in
    status)     cmd_status ;;
    logs)       cmd_logs "$2" ;;
    capture)    cmd_capture "$2" ;;
    stop)       cmd_stop ;;
    ports)      cmd_ports "$2" ;;
    clear)      cmd_clear ;;
    bugreport)  cmd_bugreport "$2" ;;
    inspect)    cmd_inspect ;;
    screenshot) cmd_screenshot "$2" ;;
    shell)      adb shell ;;
    restart)    cmd_restart ;;
    help|*)     show_help ;;
esac
