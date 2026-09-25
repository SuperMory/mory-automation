using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace MoryRPA
{
    class Program
    {
        // DPI Awareness
        [DllImport("user32.dll", SetLastError = true)]
        static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

        [DllImport("user32.dll")]
        static extern bool SetProcessDPIAware();

        // Window Station & Desktop Attachment
        [DllImport("user32.dll", SetLastError = true)]
        static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool SetProcessWindowStation(IntPtr hWinSta);

        [DllImport("user32.dll", SetLastError = true)]
        static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool SetThreadDesktop(IntPtr hDesktop);

        // Window Enumeration & Properties
        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll", EntryPoint = "GetWindowTextW", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", EntryPoint = "GetWindowTextLengthW", SetLastError = true)]
        static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool IsIconic(IntPtr hWnd); // Minimized

        [DllImport("user32.dll")]
        static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("dwmapi.dll")]
        static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

        [DllImport("user32.dll")]
        static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

        [DllImport("user32.dll")]
        static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        // Input Simulation
        [DllImport("user32.dll")]
        static extern bool SetCursorPos(int X, int Y);

        [DllImport("user32.dll")]
        static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

        [DllImport("user32.dll")]
        static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

        const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        const uint MOUSEEVENTF_LEFTUP = 0x0004;
        const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
        const uint MOUSEEVENTF_WHEEL = 0x0800;
        const uint MOUSEEVENTF_HWHEEL = 0x1000;
        const uint KEYEVENTF_KEYUP = 0x0002;

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        static void EnsureDpiAwareness()
        {
            try
            {
                // DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4
                if (!SetProcessDpiAwarenessContext(new IntPtr(-4)))
                {
                    SetProcessDPIAware();
                }
            }
            catch
            {
                try { SetProcessDPIAware(); } catch { }
            }
        }

        static void EnsureInteractiveDesktop()
        {
            try
            {
                IntPtr hWinsta = OpenWindowStation("WinSta0", false, 0x00020000 | 0x037F);
                if (hWinsta != IntPtr.Zero)
                {
                    SetProcessWindowStation(hWinsta);
                    IntPtr hDesk = OpenDesktop("Default", 0, false, 0x00020000 | 0x01FF);
                    if (hDesk != IntPtr.Zero)
                    {
                        SetThreadDesktop(hDesk);
                    }
                }
            }
            catch { }
        }

        static RECT GetExactWindowRect(IntPtr hWnd)
        {
            RECT r;
            try
            {
                // Try DwmGetWindowAttribute with DWMWA_EXTENDED_FRAME_BOUNDS (9) to exclude invisible drop shadow
                int hr = DwmGetWindowAttribute(hWnd, 9, out r, Marshal.SizeOf(typeof(RECT)));
                if (hr == 0 && (r.Right > r.Left) && (r.Bottom > r.Top))
                {
                    return r;
                }
            }
            catch { }

            GetWindowRect(hWnd, out r);
            return r;
        }

        static void Main(string[] args)
        {
            try { Console.OutputEncoding = Encoding.UTF8; } catch { }
            EnsureDpiAwareness();
            EnsureInteractiveDesktop();

            if (args.Length == 0) return;
            string cmd = args[0].ToLower();

            try
            {
                if (cmd == "list-windows")
                {
                    List<string> list = new List<string>();

                    // 1. Full Desktop Primary Screen
                    int scrW = Screen.PrimaryScreen.Bounds.Width;
                    int scrH = Screen.PrimaryScreen.Bounds.Height;
                    list.Add(string.Format("{{\"id\":0,\"hwnd\":0,\"title\":\"🖥️ 整个 Windows 桌面屏幕 ({0}×{1})\",\"rawTitle\":\"整个 Windows 桌面屏幕\",\"x\":0,\"y\":0,\"width\":{0},\"height\":{1},\"isScreen\":true,\"process\":\"desktop\"}}", scrW, scrH));

                    // 2. Enumerate Visible Top-Level Windows
                    EnumWindows((hWnd, lParam) =>
                    {
                        if (!IsWindowVisible(hWnd)) return true;

                        int len = GetWindowTextLength(hWnd);
                        if (len == 0) return true;

                        StringBuilder sb = new StringBuilder(len + 1);
                        GetWindowText(hWnd, sb, sb.Capacity);
                        string title = sb.ToString().Trim();

                        if (string.IsNullOrEmpty(title)) return true;

                        // Filter system utility / background tooltips
                        if (title == "Program Manager" || title == "MSCTFIME UI" || title == "Default IME" ||
                            title == "CiceroUIWndFrame" || title == "DesktopWindowXamlSource" || title.StartsWith("GDI+ Window"))
                        {
                            return true;
                        }

                        RECT r = GetExactWindowRect(hWnd);
                        int w = r.Right - r.Left;
                        int h = r.Bottom - r.Top;

                        if (w <= 30 || h <= 30) return true;

                        uint pid;
                        GetWindowThreadProcessId(hWnd, out pid);

                        string procName = "app";
                        try
                        {
                            Process p = Process.GetProcessById((int)pid);
                            procName = p.ProcessName;
                        }
                        catch { }

                        bool minimized = IsIconic(hWnd);

                        string item = string.Format("{{\"id\":{0},\"hwnd\":{0},\"title\":\"🪟 {1}\",\"rawTitle\":\"{1}\",\"x\":{2},\"y\":{3},\"width\":{4},\"height\":{5},\"pid\":{6},\"process\":\"{7}\",\"minimized\":{8}}}",
                            hWnd.ToInt64(), EscapeJson(title), r.Left, r.Top, w, h, pid, procName, minimized ? "true" : "false");
                        list.Add(item);
                        return true;
                    }, IntPtr.Zero);

                    Console.WriteLine("[" + string.Join(",", list.ToArray()) + "]");
                }
                else if (cmd == "focus-window" && args.Length >= 2)
                {
                    long hwndVal = long.Parse(args[1]);
                    IntPtr hWnd = new IntPtr(hwndVal);
                    if (hWnd != IntPtr.Zero)
                    {
                        if (IsIconic(hWnd)) ShowWindow(hWnd, 9); // SW_RESTORE
                        ShowWindow(hWnd, 5); // SW_SHOW
                        SwitchToThisWindow(hWnd, true);
                        SetForegroundWindow(hWnd);
                        Console.WriteLine("OK");
                    }
                }
                else if (cmd == "capture-gdi")
                {
                    // Parameters: capture-gdi [x] [y] [width] [height] [outFilePath]
                    int left = 0;
                    int top = 0;
                    int width = Screen.PrimaryScreen.Bounds.Width;
                    int height = Screen.PrimaryScreen.Bounds.Height;
                    string outPath = null;

                    if (args.Length >= 5)
                    {
                        left = int.Parse(args[1]);
                        top = int.Parse(args[2]);
                        int reqW = int.Parse(args[3]);
                        int reqH = int.Parse(args[4]);
                        if (reqW > 0) width = reqW;
                        if (reqH > 0) height = reqH;
                    }

                    if (args.Length >= 6 && !string.IsNullOrEmpty(args[5]))
                    {
                        outPath = args[5];
                    }

                    using (Bitmap bmp = new Bitmap(width, height, PixelFormat.Format32bppArgb))
                    {
                        using (Graphics g = Graphics.FromImage(bmp))
                        {
                            // 100% Native Windows GDI BitBlt - Absolutely lossless, zero compression/video scaling!
                            g.CopyFromScreen(left, top, 0, 0, new Size(width, height), CopyPixelOperation.SourceCopy);
                        }

                        if (!string.IsNullOrEmpty(outPath))
                        {
                            bmp.Save(outPath, ImageFormat.Png);
                            Console.WriteLine(string.Format("{{\"success\":true,\"x\":{0},\"y\":{1},\"width\":{2},\"height\":{3},\"file\":\"{4}\"}}",
                                left, top, width, height, EscapeJson(outPath)));
                        }
                        else
                        {
                            using (MemoryStream ms = new MemoryStream())
                            {
                                bmp.Save(ms, ImageFormat.Png);
                                byte[] bytes = ms.ToArray();
                                Console.WriteLine("DATAURL:data:image/png;base64," + Convert.ToBase64String(bytes));
                            }
                        }
                    }
                }
                else if (cmd == "capture-window" && args.Length >= 2)
                {
                    long hwndVal = long.Parse(args[1]);
                    IntPtr hWnd = new IntPtr(hwndVal);
                    string outPath = args.Length >= 3 ? args[2] : null;

                    if (hWnd == IntPtr.Zero)
                    {
                        // Desktop Primary Screen
                        int w = Screen.PrimaryScreen.Bounds.Width;
                        int h = Screen.PrimaryScreen.Bounds.Height;
                        using (Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
                        {
                            using (Graphics g = Graphics.FromImage(bmp))
                            {
                                g.CopyFromScreen(0, 0, 0, 0, new Size(w, h), CopyPixelOperation.SourceCopy);
                            }
                            if (!string.IsNullOrEmpty(outPath))
                            {
                                bmp.Save(outPath, ImageFormat.Png);
                                Console.WriteLine(string.Format("{{\"success\":true,\"hwnd\":0,\"x\":0,\"y\":0,\"width\":{0},\"height\":{1},\"file\":\"{2}\"}}",
                                    w, h, EscapeJson(outPath)));
                            }
                            else
                            {
                                using (MemoryStream ms = new MemoryStream())
                                {
                                    bmp.Save(ms, ImageFormat.Png);
                                    Console.WriteLine("DATAURL:data:image/png;base64," + Convert.ToBase64String(ms.ToArray()));
                                }
                            }
                        }
                    }
                    else
                    {
                        if (IsIconic(hWnd))
                        {
                            ShowWindow(hWnd, 9); // SW_RESTORE
                            Thread.Sleep(80);
                        }
                        SetForegroundWindow(hWnd);
                        Thread.Sleep(50);

                        RECT r = GetExactWindowRect(hWnd);
                        int w = Math.Max(1, r.Right - r.Left);
                        int h = Math.Max(1, r.Bottom - r.Top);

                        using (Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
                        {
                            using (Graphics g = Graphics.FromImage(bmp))
                            {
                                g.CopyFromScreen(r.Left, r.Top, 0, 0, new Size(w, h), CopyPixelOperation.SourceCopy);
                            }
                            if (!string.IsNullOrEmpty(outPath))
                            {
                                bmp.Save(outPath, ImageFormat.Png);
                                Console.WriteLine(string.Format("{{\"success\":true,\"hwnd\":{0},\"x\":{1},\"y\":{2},\"width\":{3},\"height\":{4},\"file\":\"{5}\"}}",
                                    hWnd.ToInt64(), r.Left, r.Top, w, h, EscapeJson(outPath)));
                            }
                            else
                            {
                                using (MemoryStream ms = new MemoryStream())
                                {
                                    bmp.Save(ms, ImageFormat.Png);
                                    Console.WriteLine("DATAURL:data:image/png;base64," + Convert.ToBase64String(ms.ToArray()));
                                }
                            }
                        }
                    }
                }
                else if (cmd == "move" && args.Length >= 3)
                {
                    int x = int.Parse(args[1]);
                    int y = int.Parse(args[2]);
                    SetCursorPos(x, y);
                    Console.WriteLine("OK");
                }
                else if (cmd == "click" && args.Length >= 4)
                {
                    int x = int.Parse(args[1]);
                    int y = int.Parse(args[2]);
                    string btn = args[3].ToLower();
                    if (x >= 0 && y >= 0)
                    {
                        SetCursorPos(x, y);
                        Thread.Sleep(15);
                    }

                    if (btn == "right")
                    {
                        mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
                        Thread.Sleep(20);
                        mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
                    }
                    else if (btn == "middle")
                    {
                        mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, 0);
                        Thread.Sleep(20);
                        mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0);
                    }
                    else
                    {
                        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                        Thread.Sleep(20);
                        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                    }
                    Console.WriteLine("OK");
                }
                else if (cmd == "dblclick" && args.Length >= 3)
                {
                    int x = int.Parse(args[1]);
                    int y = int.Parse(args[2]);
                    if (x >= 0 && y >= 0)
                    {
                        SetCursorPos(x, y);
                        Thread.Sleep(15);
                    }

                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                    Thread.Sleep(20);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                    Thread.Sleep(60);
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                    Thread.Sleep(20);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                    Console.WriteLine("OK");
                }
                else if (cmd == "scroll" && args.Length >= 2)
                {
                    int deltaY = int.Parse(args[1]);
                    int deltaX = args.Length >= 3 ? int.Parse(args[2]) : 0;

                    if (deltaY != 0)
                    {
                        mouse_event(MOUSEEVENTF_WHEEL, 0, 0, unchecked((uint)deltaY), 0);
                    }
                    if (deltaX != 0)
                    {
                        mouse_event(MOUSEEVENTF_HWHEEL, 0, 0, unchecked((uint)deltaX), 0);
                    }
                    Console.WriteLine("OK");
                }
                else if (cmd == "text" && args.Length >= 2)
                {
                    string text = args[1];
                    SendKeys.SendWait(text);
                    Console.WriteLine("OK");
                }
                else if (cmd == "key" && args.Length >= 3)
                {
                    byte vk = byte.Parse(args[1]);
                    string action = args[2].ToLower();
                    if (action == "down")
                    {
                        keybd_event(vk, 0, 0, 0);
                    }
                    else if (action == "up")
                    {
                        keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
                    }
                    else
                    {
                        keybd_event(vk, 0, 0, 0);
                        Thread.Sleep(20);
                        keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
                    }
                    Console.WriteLine("OK");
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(ex.Message);
            }
        }

        static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", " ");
        }
    }
}
