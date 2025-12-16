# Dicee ADB Helper Functions
# Fish shell functions for Android device testing
#
# Installation:
#   cp scripts/dicee-adb.fish ~/.config/fish/functions/
#   exec fish  # Reload
#
# Usage:
#   dicee-adb status      # Check device connection
#   dicee-adb logs        # Stream Chrome logs
#   dicee-adb capture     # Start log capture session
#   dicee-adb stop        # Stop capture
#   dicee-adb ports       # Setup port forwarding
#   dicee-adb bugreport   # Generate bug report
#   dicee-adb inspect     # Open Chrome inspect page

function dicee-adb --description "Dicee Android debugging utilities"
    set -l subcommand $argv[1]
    set -l args $argv[2..-1]

    switch "$subcommand"
        case status
            _dicee_adb_status
        case logs
            _dicee_adb_logs $args
        case capture
            _dicee_adb_capture $args
        case stop
            _dicee_adb_stop
        case ports
            _dicee_adb_ports $args
        case clear
            _dicee_adb_clear_ports
        case bugreport
            _dicee_adb_bugreport $args
        case inspect
            _dicee_adb_inspect
        case shell
            _dicee_adb_shell $args
        case screenshot
            _dicee_adb_screenshot $args
        case restart
            _dicee_adb_restart
        case cdp
            _dicee_adb_cdp $args
        case console
            _dicee_adb_console $args
        case help '*'
            _dicee_adb_help
    end
end

# ============================================================================
# Subcommand implementations
# ============================================================================

function _dicee_adb_status --description "Check device connection status"
    echo "🔍 Checking ADB connection..."
    echo ""

    # Check if ADB is installed
    if not command -q adb
        echo "❌ ADB not found. Install with: brew install android-platform-tools"
        return 1
    end

    set -l adb_version (adb --version | head -1)
    echo "📦 $adb_version"
    echo ""

    # Get connected devices
    set -l devices (adb devices -l 2>/dev/null)
    set -l device_count (echo "$devices" | tail -n +2 | grep -v "^$" | wc -l | tr -d ' ')

    echo "📱 Connected devices: $device_count"
    echo ""

    if test "$device_count" -eq 0
        echo "⚠️  No devices connected"
        echo ""
        echo "Troubleshooting:"
        echo "  1. Connect device via USB"
        echo "  2. Enable Developer Options on device"
        echo "  3. Enable USB Debugging on device"
        echo "  4. Check System Settings > Privacy & Security on Mac"
        echo "  5. Run: dicee-adb restart"
        return 1
    end

    # Show device details
    echo "$devices" | tail -n +2 | while read -l line
        if test -n "$line"
            set -l serial (echo $line | awk '{print $1}')
            set -l state (echo $line | awk '{print $2}')
            set -l model (echo $line | grep -o 'model:[^ ]*' | cut -d: -f2)
            set -l device (echo $line | grep -o 'device:[^ ]*' | cut -d: -f2)

            if test "$state" = "device"
                echo "  ✅ $serial"
                test -n "$model"; and echo "     Model: $model"
                test -n "$device"; and echo "     Device: $device"
            else if test "$state" = "unauthorized"
                echo "  ⚠️  $serial (unauthorized - check device for prompt)"
            else
                echo "  ❌ $serial ($state)"
            end
        end
    end

    # Show port forwarding status
    echo ""
    echo "🔌 Port forwarding:"
    set -l forwards (adb reverse --list 2>/dev/null)
    if test -n "$forwards"
        echo "$forwards" | while read -l line
            echo "  $line"
        end
    else
        echo "  None configured (run: dicee-adb ports)"
    end
end

function _dicee_adb_logs --description "Stream Chrome/WebView logs"
    set -l filter $argv[1]

    if test -z "$filter"
        set filter "chromium:D"
    end

    echo "📋 Streaming logs with filter: $filter *:S"
    echo "   Press Ctrl+C to stop"
    echo ""

    # Clear buffer first for fresh logs
    adb logcat -c 2>/dev/null

    # Stream with color
    adb logcat -v color $filter '*:S'
end

function _dicee_adb_capture --description "Start named log capture session"
    set -l session_name $argv[1]

    if test -z "$session_name"
        set session_name "capture"
    end

    # Create log directory
    set -l log_dir ~/Desktop/dicee-logs/(date +%Y-%m-%d)
    mkdir -p $log_dir

    set -l timestamp (date +%H%M%S)
    set -l log_file "$log_dir/$session_name-$timestamp.log"
    set -l pid_file /tmp/dicee-adb-capture.pid

    # Check for existing capture
    if test -f $pid_file
        set -l existing_pid (cat $pid_file)
        if kill -0 $existing_pid 2>/dev/null
            echo "⚠️  Capture already running (PID: $existing_pid)"
            echo "   Stop with: dicee-adb stop"
            return 1
        end
    end

    echo "📹 Starting capture session: $session_name"
    echo "   Output: $log_file"
    echo ""

    # Clear buffer
    adb logcat -c 2>/dev/null

    # Start capture in background
    adb logcat chromium:D WebView:D '*:E' > $log_file &
    set -l capture_pid $last_pid

    # Save PID and session info
    echo $capture_pid > $pid_file
    echo $log_file > /tmp/dicee-adb-capture.log

    echo "✅ Capture started (PID: $capture_pid)"
    echo "   Stop with: dicee-adb stop"
    echo ""
    echo "   Tail logs: tail -f $log_file"
end

function _dicee_adb_stop --description "Stop active log capture"
    set -l pid_file /tmp/dicee-adb-capture.pid
    set -l log_file_ref /tmp/dicee-adb-capture.log

    if not test -f $pid_file
        echo "⚠️  No active capture session"
        return 1
    end

    set -l capture_pid (cat $pid_file)
    set -l log_file (cat $log_file_ref 2>/dev/null)

    if kill -0 $capture_pid 2>/dev/null
        kill $capture_pid 2>/dev/null
        echo "⏹️  Stopped capture (PID: $capture_pid)"
    else
        echo "⚠️  Capture process not running"
    end

    rm -f $pid_file $log_file_ref

    if test -n "$log_file" -a -f "$log_file"
        set -l line_count (wc -l < $log_file | tr -d ' ')
        set -l file_size (du -h $log_file | cut -f1)
        echo ""
        echo "📄 Log file: $log_file"
        echo "   Lines: $line_count"
        echo "   Size: $file_size"
    end
end

function _dicee_adb_ports --description "Setup port forwarding for local dev"
    set -l custom_port $argv[1]

    echo "🔌 Setting up port forwarding..."
    echo ""

    # Default ports for Dicee development
    set -l ports 3000 5173 8787 54321 54323

    if test -n "$custom_port"
        set ports $custom_port
    end

    for port in $ports
        if adb reverse tcp:$port tcp:$port 2>/dev/null
            echo "  ✅ tcp:$port → localhost:$port"
        else
            echo "  ❌ Failed to forward port $port"
        end
    end

    echo ""
    echo "Your device can now access:"
    echo "  http://localhost:3000  (SvelteKit)"
    echo "  http://localhost:5173  (Vite)"
    echo "  http://localhost:8787  (Wrangler DO)"
    echo "  http://localhost:54321 (Supabase API)"
end

function _dicee_adb_clear_ports --description "Clear all port forwarding"
    echo "🔌 Clearing port forwarding..."

    adb reverse --remove-all 2>/dev/null

    echo "✅ Port forwarding cleared"
end

function _dicee_adb_bugreport --description "Generate full bug report"
    set -l name $argv[1]

    if test -z "$name"
        set name "bugreport"
    end

    set -l log_dir ~/Desktop/dicee-logs/(date +%Y-%m-%d)
    mkdir -p $log_dir

    set -l timestamp (date +%H%M%S)
    set -l output_file "$log_dir/$name-$timestamp.zip"

    echo "🐛 Generating bug report..."
    echo "   This may take 1-2 minutes..."
    echo ""

    adb bugreport $output_file

    if test -f $output_file
        set -l file_size (du -h $output_file | cut -f1)
        echo ""
        echo "✅ Bug report saved: $output_file"
        echo "   Size: $file_size"
    else
        echo "❌ Failed to generate bug report"
        return 1
    end
end

function _dicee_adb_inspect --description "Open Chrome inspect page"
    echo "🔍 Opening Chrome DevTools Remote Debugging..."
    open "chrome://inspect/#devices"
end

function _dicee_adb_shell --description "Open ADB shell"
    echo "📱 Opening ADB shell..."
    echo "   Type 'exit' to return"
    echo ""
    adb shell $args
end

function _dicee_adb_screenshot --description "Capture device screenshot"
    set -l name $argv[1]

    if test -z "$name"
        set name "screenshot"
    end

    set -l log_dir ~/Desktop/dicee-logs/(date +%Y-%m-%d)
    mkdir -p $log_dir

    set -l timestamp (date +%H%M%S)
    set -l output_file "$log_dir/$name-$timestamp.png"

    echo "📸 Capturing screenshot..."

    adb exec-out screencap -p > $output_file

    if test -f $output_file
        echo "✅ Screenshot saved: $output_file"
        open $output_file
    else
        echo "❌ Failed to capture screenshot"
        return 1
    end
end

function _dicee_adb_restart --description "Restart ADB server"
    echo "🔄 Restarting ADB server..."

    adb kill-server 2>/dev/null
    sleep 1
    adb start-server 2>/dev/null

    echo "✅ ADB server restarted"
    echo ""

    _dicee_adb_status
end

function _dicee_adb_cdp --description "Setup Chrome DevTools Protocol forwarding"
    set -l action $argv[1]

    switch "$action"
        case setup ''
            echo "🔌 Setting up CDP port forwarding..."
            adb forward tcp:9222 localabstract:chrome_devtools_remote 2>/dev/null
            echo "✅ CDP available at localhost:9222"
            echo ""
            echo "List tabs: curl -s http://localhost:9222/json | jq"
            echo "Or run:    dicee-adb console list"
        case clear
            echo "🔌 Clearing CDP port forwarding..."
            adb forward --remove tcp:9222 2>/dev/null
            echo "✅ CDP forwarding removed"
        case '*'
            echo "Usage: dicee-adb cdp [setup|clear]"
    end
end

function _dicee_adb_console --description "Monitor Chrome console via CDP"
    set -l action $argv[1]
    set -l cdp_script "$HOME/Development/personal/dicee/packages/web/scripts/cdp-console-monitor.mjs"

    # Ensure CDP forwarding is set up
    adb forward tcp:9222 localabstract:chrome_devtools_remote 2>/dev/null

    switch "$action"
        case list
            node $cdp_script --list
        case local
            node $cdp_script --local
        case prod production
            node $cdp_script --production
        case tab
            set -l tab_id $argv[2]
            if test -z "$tab_id"
                echo "Usage: dicee-adb console tab <id>"
                echo ""
                node $cdp_script --list
                return 1
            end
            node $cdp_script --tab $tab_id
        case url
            set -l pattern $argv[2]
            if test -z "$pattern"
                echo "Usage: dicee-adb console url <pattern>"
                return 1
            end
            node $cdp_script --url $pattern
        case '' '*'
            echo "📱 Chrome Console Monitor"
            echo ""
            echo "Usage: dicee-adb console <command>"
            echo ""
            echo "Commands:"
            echo "  list              List available Chrome tabs"
            echo "  local             Monitor localhost/local network tab"
            echo "  prod              Monitor production tab (gamelobby.jefahnierocks.com)"
            echo "  tab <id>          Monitor specific tab by ID"
            echo "  url <pattern>     Monitor tab matching URL pattern"
            echo ""
            echo "Examples:"
            echo "  dicee-adb console list"
            echo "  dicee-adb console local"
            echo "  dicee-adb console prod"
            echo "  dicee-adb console tab 359"
            echo "  dicee-adb console url dicee"
    end
end

function _dicee_adb_help --description "Show help"
    echo "🎲 Dicee ADB Helper - Android Testing Utilities"
    echo ""
    echo "Usage: dicee-adb <command> [args]"
    echo ""
    echo "Commands:"
    echo "  status              Check device connection status"
    echo "  logs [filter]       Stream Chrome/WebView logs"
    echo "                      Default filter: chromium:D"
    echo "                      Example: dicee-adb logs 'chromium:V'"
    echo "  capture [name]      Start named log capture session"
    echo "                      Saves to ~/Desktop/dicee-logs/"
    echo "  stop                Stop active capture session"
    echo "  ports [port]        Setup port forwarding (default: 3000,5173,8787,54321)"
    echo "  clear               Clear all port forwarding"
    echo "  bugreport [name]    Generate full device bug report"
    echo "  inspect             Open Chrome remote debugging page"
    echo "  screenshot [name]   Capture device screenshot"
    echo "  shell               Open ADB shell on device"
    echo "  restart             Restart ADB server"
    echo "  cdp [setup|clear]   Setup/clear CDP port forwarding"
    echo "  console <cmd>       Monitor Chrome console (see below)"
    echo "  help                Show this help message"
    echo ""
    echo "Console Monitor Commands:"
    echo "  console list        List available Chrome tabs"
    echo "  console local       Monitor localhost/local network tab"
    echo "  console prod        Monitor production tab"
    echo "  console tab <id>    Monitor specific tab by ID"
    echo "  console url <pat>   Monitor tab matching URL pattern"
    echo ""
    echo "Examples:"
    echo "  dicee-adb status"
    echo "  dicee-adb logs"
    echo "  dicee-adb capture feature-test"
    echo "  dicee-adb ports"
    echo "  dicee-adb console local     # Monitor local dev"
    echo "  dicee-adb console prod      # Monitor production"
    echo ""
    echo "Log directory: ~/Desktop/dicee-logs/"
    echo ""
    echo "For web debugging, use Chrome:"
    echo "  1. Connect device"
    echo "  2. Open Chrome on device, load your app"
    echo "  3. Run: dicee-adb inspect"
    echo "  4. Click 'inspect' next to your tab"
    echo ""
    echo "For agent console monitoring:"
    echo "  1. Run: dicee-adb cdp setup"
    echo "  2. Run: pnpm cdp:local  or  pnpm cdp:prod"
end
