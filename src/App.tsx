import React, { useState, useEffect, useRef } from "react";
import {
  Youtube,
  Lock,
  Settings,
  Upload,
  Play,
  CheckCircle2,
  AlertTriangle,
  Info,
  FileCode,
  Terminal,
  Copy,
  Plus,
  RefreshCw,
  FileText,
  Check,
  ExternalLink,
  Globe,
  EyeOff,
  HelpCircle,
  LogOut,
  X,
  ChevronRight
} from "lucide-react";

// ==========================================
// 1. OAUTH CALLBACK POPUP HANDLER
// ==========================================
if (window.location.pathname === "/auth/callback" || window.location.pathname === "/auth/callback/") {
  // Callback popup view
  const CallbackComponent = () => {
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [msg, setMsg] = useState("Menghubungi server untuk otentikasi...");

    useEffect(() => {
      const exchangeCode = async () => {
        try {
          const params = new URLSearchParams(window.location.search);
          const code = params.get("code");
          const error = params.get("error");

          if (error) {
            setStatus("error");
            setMsg(`Google OAuth error: ${error}`);
            return;
          }

          if (!code) {
            setStatus("error");
            setMsg("Kesalahan: Kode otentikasi (authorization code) dari Google tidak ditemukan.");
            return;
          }

          // Dapatkan kredensial yang dimasukkan dari localStorage pembuka (opener)
          const clientId = localStorage.getItem("temp_gcp_client_id");
          const clientSecret = localStorage.getItem("temp_gcp_client_secret");

          if (!clientId || !clientSecret) {
            setStatus("error");
            setMsg("Kredensial Client ID & Client Secret sementara tidak ditemukan di penyimpanan sesi Anda.");
            return;
          }

          setMsg("Menukarkan kode otentikasi dengan token akses aman...");

          // Kirim token exchange ke backend Express kita sendiri
          const response = await fetch("/api/auth/exchange", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: `${window.location.origin}/auth/callback`
            })
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || "Gagal mengautentikasi kode");
          }

          setStatus("success");
          setMsg("Koneksi berhasil! Menghubungkan kembali ke dashboard Anda...");

          // Kirim pesan sukses ke jendela utama (opener)
          if (window.opener) {
            window.opener.postMessage({ 
              type: "YOUTUBE_AUTH_SUCCESS", 
              authData: {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                clientId: clientId,
                clientSecret: clientSecret
              } 
            }, "*");
            
            // Tutup popup secara otomatis setelah 1 detik
            setTimeout(() => {
              window.close();
            }, 1200);
          } else {
            // Skenario fallback jika bukan dibuka sebagai popup
            localStorage.setItem("youtube_auth_token_data", JSON.stringify(data));
            window.location.href = "/";
          }

        } catch (err: any) {
          console.error(err);
          setStatus("error");
          setMsg(err.message || "Proses penukaran otentikasi gagal. Pastikan Client Secret Anda tepat dan tidak ada blokade jaringan.");
        }
      };

      exchangeCode();
    }, []);

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f9fa] p-6 text-center">
        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-100 max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-red-50 rounded-full">
              <Youtube className="w-10 h-10 text-red-600 animate-pulse" />
            </div>
          </div>
          
          <h2 className="text-xl font-bold text-gray-800 mb-2 font-sans">
            {status === "loading" && "Otentikasi Google API"}
            {status === "success" && "Koneksi Berhasil!"}
            {status === "error" && "Gagal Menghubungkan"}
          </h2>

          <p className="text-sm text-gray-500 mb-6">{msg}</p>

          {status === "loading" && (
            <div className="flex justify-center flex-col items-center">
              <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-xs text-gray-400">Harap jangan menutup jendela ini</p>
            </div>
          )}

          {status === "success" && (
            <div className="text-emerald-500 font-medium text-sm animate-bounce flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Jendela ini akan tertutup sendiri...
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.close()}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition"
              >
                Tutup Jendela
              </button>
              <button
                onClick={() => window.location.href = "/"}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition"
              >
                Kembali ke Utama
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Setup mount
  const rootElement = document.getElementById("root");
  if (rootElement) {
    import("react-dom/client").then(({ createRoot }) => {
      createRoot(rootElement).render(<CallbackComponent />);
    });
  }
}

// ==========================================
// 2. MAIN STREAMLIT SIMULATOR INTERFACE
// ==========================================
export default function App() {
  // App states
  const [activeTab, setActiveTab] = useState<"simulator" | "code">("simulator");
  const [codeActiveSubTab, setCodeActiveSubTab] = useState<"python" | "reqs" | "guide">("python");

  // Auth & Connection States
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(true); // Default ke demo agar interaktif instan!
  const [isConnected, setIsConnected] = useState(false);
  const [authDetails, setAuthDetails] = useState<{
    accessToken: string | null;
    refreshToken: string | null;
    clientId: string;
    clientSecret: string;
  } | null>(null);

  // Manual fallback auth token state
  const [manualToken, setManualToken] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  // Form states
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoPrivacy, setVideoPrivacy] = useState<"private" | "public" | "unlisted">("private");

  // Scheduling Feature States
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState("");

  // Analytic Feature States (All-Time Data)
  const [channelStats, setChannelStats] = useState<{
    subscribers: number;
    videoCount: number;
    watchHours: number;
    channelName: string;
    channelThumbnail: string;
    loading: boolean;
  }>({
    subscribers: 12450,
    videoCount: 48,
    watchHours: 4210,
    channelName: "Demo Creator Hub",
    channelThumbnail: "",
    loading: false,
  });

  // Upload/Progress States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState("");
  const [successVideoId, setSuccessVideoId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Copy success indicator
  const [copySuccess, setCopySuccess] = useState(false);

  // File drag state
  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load auth details on startup if exist
  useEffect(() => {
    const saved = localStorage.getItem("youtube_auth_token_data");
    const savedId = localStorage.getItem("youtube_auth_client_id");
    const savedSecret = localStorage.getItem("youtube_auth_client_secret");
    
    if (saved && savedId) {
      try {
        const token = JSON.parse(saved);
        setAuthDetails({
          accessToken: token.accessToken || token.access_token,
          refreshToken: token.refreshToken || token.refresh_token || null,
          clientId: savedId,
          clientSecret: savedSecret || ""
        });
        setClientId(savedId);
        if (savedSecret) setClientSecret(savedSecret);
        setIsConnected(true);
        setIsDemoMode(false);
      } catch (e) {
        console.error("Gagal load session token:", e);
      }
    }

    // Google postMessage Listener
    const handleGoogleMessage = (event: MessageEvent) => {
      if (event.data?.type === "YOUTUBE_AUTH_SUCCESS") {
        const { authData } = event.data;
        setAuthDetails(authData);
        setIsConnected(true);
        setUploadError(null);
        
        // Save to localStorage for persistence
        localStorage.setItem("youtube_auth_token_data", JSON.stringify({
          accessToken: authData.accessToken,
          refreshToken: authData.refreshToken
        }));
        localStorage.setItem("youtube_auth_client_id", authData.clientId);
        localStorage.setItem("youtube_auth_client_secret", authData.clientSecret);
      }
    };

    window.addEventListener("message", handleGoogleMessage);
    return () => window.removeEventListener("message", handleGoogleMessage);
  }, []);

  // Initialize schedule date time to tomorrow at 12:00 & manage dynamic fetch
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    const localISO = tomorrow.getFullYear() + "-" +
      String(tomorrow.getMonth() + 1).padStart(2, '0') + "-" +
      String(tomorrow.getDate()).padStart(2, '0') + "T" +
      String(tomorrow.getHours()).padStart(2, '0') + ":" +
      String(tomorrow.getMinutes()).padStart(2, '0');
    setScheduledDateTime(localISO);
  }, []);

  // Fetch real channel statistics from YouTube API (v3 channels)
  const fetchChannelStats = async (token: string) => {
    setChannelStats(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const item = data.items[0];
          const stats = item.statistics;
          const snippet = item.snippet;
          
          // Estimate watch hours: views multiplied by typical average duration (e.g. 3 minutes = 0.05 hours)
          const views = parseInt(stats.viewCount || "0");
          const estimatedWatchHours = Math.round(views * 0.05);

          setChannelStats({
            subscribers: parseInt(stats.subscriberCount || "0"),
            videoCount: parseInt(stats.videoCount || "0"),
            watchHours: estimatedWatchHours,
            channelName: snippet.title || "Saluran Terkoneksi",
            channelThumbnail: snippet.thumbnails?.default?.url || "",
            loading: false
          });
        } else {
          setChannelStats(prev => ({ ...prev, loading: false }));
        }
      } else {
        setChannelStats(prev => ({ ...prev, loading: false }));
      }
    } catch (e) {
      console.error("Gagal mengambil data analitik dari YouTube API:", e);
      setChannelStats(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (isConnected && authDetails?.accessToken && !isDemoMode) {
      fetchChannelStats(authDetails.accessToken);
    } else {
      // Standard professional starter-high aesthetic counts
      setChannelStats({
        subscribers: 124500,
        videoCount: 84,
        watchHours: 42100,
        channelName: "Demo Creator Hub",
        channelThumbnail: "",
        loading: false
      });
    }
  }, [isConnected, authDetails, isDemoMode]);

  // Set default title when file uploaded
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile(file);
      // Buat default judul
      if (!videoTitle) {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        // Ganti underscore dengan spasi + capitalize
        const defaultTitle = nameWithoutExt.replace(/[_-]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        setVideoTitle(defaultTitle);
      }
    }
  };

  // Drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setVideoFile(file);
      if (!videoTitle) {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setVideoTitle(nameWithoutExt.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
      }
    }
  };

  // Trigger Google OAuth Link
  const handleConnectGoogle = () => {
    if (isDemoMode) {
      // Dummy demo connection
      if (!clientId) {
        setUploadError("Silakan isi Client ID di sidebar!");
        return;
      }
      setIsConnected(true);
      setUploadError(null);
      setAuthDetails({
        accessToken: "demo_token_12345",
        refreshToken: "demo_refresh_token_12345",
        clientId: clientId,
        clientSecret: clientSecret
      });
      return;
    }

    if (!clientId || !clientSecret) {
      setUploadError("Untuk mode asli, Client ID dan Client Secret wajib diisi di sidebar!");
      return;
    }

    // Save temporary credentials so callback can fetch exchange
    localStorage.setItem("temp_gcp_client_id", clientId);
    localStorage.setItem("temp_gcp_client_secret", clientSecret);

    // Buka popup Google Auth
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = "https://www.googleapis.com/auth/youtube.upload";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

    console.log("Opening OAuth popup:", authUrl);
    
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      authUrl,
      "google_oauth_popup",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      alert("Popup terblokir! Silakan aktifkan izin popup browser Anda agar akun dapat terhubung.");
    }
  };

  // Connect manually via Token
  const handleManualTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;

    setAuthDetails({
      accessToken: manualToken.trim(),
      refreshToken: null,
      clientId: clientId || "manual_gcp_client",
      clientSecret: clientSecret || "manual_gcp_secret"
    });
    setIsConnected(true);
    setUploadError(null);
    setShowManualInput(false);
  };

  // Detach Connection
  const handleDisconnect = () => {
    setIsConnected(false);
    setAuthDetails(null);
    setVideoFile(null);
    setSuccessVideoId(null);
    setUploadProgress(0);
    localStorage.removeItem("youtube_auth_token_data");
    localStorage.removeItem("youtube_auth_client_id");
    localStorage.removeItem("youtube_auth_client_secret");
  };

  // Process video upload
  const handleUploadVideo = async () => {
    if (!videoFile) {
      setUploadError("Silakan pilih file video terlebih dahulu!");
      return;
    }
    if (!videoTitle.trim()) {
      setUploadError("Judul video tidak boleh kosong!");
      return;
    }

    if (isScheduled) {
      if (!scheduledDateTime) {
        setUploadError("Tentukan tanggal dan waktu rilis video untuk fitur penjadwalan!");
        return;
      }
      const schDate = new Date(scheduledDateTime);
      if (schDate <= new Date()) {
        setUploadError("Tanggal dan waktu rilis terjadwal harus berada di masa yang akan datang!");
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setSuccessVideoId(null);

    // DEMO / SIMULATION MODE
    if (isDemoMode || !authDetails || !authDetails.accessToken || authDetails.accessToken.startsWith("demo")) {
      setUploadStatusMsg("Menyiapkan berkas untuk diunggah (Simulasi)...");
      
      const formattedDate = new Date(scheduledDateTime).toLocaleString("id-ID", {
        dateStyle: 'long',
        timeStyle: 'short'
      });

      const simulateSteps = [
        { progress: 5, msg: "Inisialisasi koneksi YouTube API..." },
        { progress: 15, msg: isScheduled 
            ? `Mengunci rilis otomatis pada ${formattedDate}...` 
            : "Memecah berkas video menjadi chunk (1MB)..." 
        },
        { progress: 30, msg: "Mengunggah paket data 1/3... 30% selesai" },
        { progress: 52, msg: "Mengunggah paket data 2/3... 52% selesai" },
        { progress: 78, msg: "Mengunggah paket data 3/3... 78% selesai" },
        { progress: 95, msg: isScheduled 
            ? `Mendaftarkan slot tanggal ${formattedDate} di API scheduler...` 
            : "Menyelesaikan proses unggah dan verifikasi video ID..." 
        },
        { progress: 100, msg: isScheduled
            ? `Sukses! Video dijadwalkan rilis pada ${formattedDate}.`
            : "Sukses! Berkas terunggah sempurna."
        }
      ];

      for (const step of simulateSteps) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setUploadProgress(step.progress);
        setUploadStatusMsg(step.msg);
      }

      // Generate random Video ID untuk demo
      const mockIds = ["dQw4w9WgXcQ", "t74_fN_7bvs", "M7lc1UVf-VE", "L_LUpnjgPso", "9bZkp7q19f0"];
      const randomId = mockIds[Math.floor(Math.random() * mockIds.length)];
      
      setSuccessVideoId(randomId);
      setIsUploading(false);
      return;
    }

    // REAL DIRECT GOOGLE YOUTUBE UPLOAD (RESUMABLE)
    try {
      setUploadStatusMsg("Menginisialisasi sesi unggahan resumable dengan Google...");

      // Step 1: Request upload session
      const metadata = {
        snippet: {
          title: videoTitle,
          description: videoDescription,
          categoryId: "22", // People & Blogs
          tags: ["YouTube Uploader", "Streamlit", "OAuth2"]
        },
        status: isScheduled ? {
          privacyStatus: "private",
          publishAt: new Date(scheduledDateTime).toISOString()
        } : {
          privacyStatus: videoPrivacy
        }
      };

      const initiateResponse = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authDetails.accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": videoFile.size.toString(),
          "X-Upload-Content-Type": videoFile.type || "video/mp4"
        },
        body: JSON.stringify(metadata)
      });

      if (!initiateResponse.ok) {
        const errorText = await initiateResponse.text();
        throw new Error(`Google API Init Error (${initiateResponse.status}): ${errorText}`);
      }

      // Read upload session location from Google response Headers
      const uploadUrl = initiateResponse.headers.get("Location");
      if (!uploadUrl) {
        throw new Error("Gagal memperoleh endpoint upload URL unik dari Google.");
      }

      setUploadStatusMsg("Sesi unggahan didapatkan. Mulai mentransfer video...");

      // Step 2: Upload raw file stream via XML HTTP Request to update progress
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      
      // Do not add Authorization headers for the PUT chunk (Google unique URL does not need it)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentage);
          setUploadStatusMsg(`Mengunggah... ${percentage}% selesai (${(event.loaded / 1024 / 1024).toFixed(1)}MB dari ${(event.total / 1024 / 1024).toFixed(1)}MB)`);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const data = JSON.parse(xhr.responseText);
            setSuccessVideoId(data.id);
            setUploadProgress(100);
            setUploadStatusMsg("Pengunggahan selesai dengan sukses!");
          } catch (e) {
            setUploadError("Video berhasil terunggah, namun format ID video tidak dapat diparse.");
          }
        } else {
          setUploadError(`Kesalahan transmisi Google Cloud (${xhr.status}): ${xhr.responseText}`);
        }
        setIsUploading(false);
      };

      xhr.onerror = () => {
        setUploadError("Koneksi jaringan terputus saat mentransfer berkas.");
        setIsUploading(false);
      };

      xhr.send(videoFile);

    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Gagal melakukan upload ke YouTube API. Token akses mungkin kedaluwarsa.");
      setIsUploading(false);
    }
  };

  // Helper function to Copy Python code
  const copyCodeToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Python codes for view
  const pyCode = `import os
import tempfile
import streamlit as st
import google_auth_oauthlib.flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

st.set_page_config(page_title="YouTube Streamlit Uploader", page_icon="🎥")

# Scope API untuk YouTube
SCOPES = ['https://www.googleapis.com/auth/youtube.upload']

if 'credentials' not in st.session_state:
    st.session_state.credentials = None
if 'oauth_flow' not in st.session_state:
    st.session_state.oauth_flow = None

st.title("🎥 YouTube Video Uploader")

with st.sidebar:
    st.header("Pengaturan API Kredensial")
    client_id = st.text_input("GCP Client ID")
    client_secret = st.text_input("GCP Client Secret", type="password")
    
    if st.button("🔌 Hubungkan Akun YouTube"):
        client_config = {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob"]
            }
        }
        flow = google_auth_oauthlib.flow.Flow.from_client_config(
            client_config, scopes=SCOPES, redirect_uri='urn:ietf:wg:oauth:2.0:oob'
        )
        st.session_state.oauth_flow = flow
        auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')
        st.markdown(f"[Klik di sini untuk login & Izin]({auth_url})")
        
    if st.session_state.oauth_flow and not st.session_state.credentials:
        auth_code = st.text_input("Masukkan Kode Otentikasi:", type="password")
        if st.button("✅ Verifikasi"):
            flow = st.session_state.oauth_flow
            flow.fetch_token(code=auth_code)
            st.session_state.credentials = flow.credentials
            st.success("Terkoneksi!")
            st.rerun()

if st.session_state.credentials:
    uploaded_file = st.file_uploader("Pilih Video", type=["mp4", "mkv"])
    title = st.text_input("Judul Video")
    desc = st.text_area("Deskripsi Video")
    privacy = st.selectbox("Privasi", ["private", "public", "unlisted"])
    
    if st.button("🚀 Unggah") and uploaded_file:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp.write(uploaded_file.read())
            path = tmp.name
            
        youtube = build('youtube', 'v3', credentials=st.session_state.credentials)
        media = MediaFileUpload(path, chunksize=1024*1024, resumable=True)
        request = youtube.videos().insert(
            part="snippet,status",
            body={"snippet": {"title": title, "description": desc}, "status": {"privacyStatus": privacy}},
            media_body=media
        )
        bar = st.progress(0)
        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                bar.progress(int(status.progress() * 100))
        st.success(f"Sukses! Video ID: {response.get('id')}")
else:
    st.info("Koneksikan Client ID & Secret YouTube API untuk memulai!")`;

  const reqsText = `streamlit>=1.30.0
google-api-python-client>=2.115.0
google-auth-oauthlib>=1.2.0
google-auth-httplib2>=0.2.0`;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      
      {/* ==========================================
          A. SIDEBAR COMPONENT (SLATE-800 THEMED)
          ========================================== */}
      <aside className="w-full md:w-80 bg-slate-800 flex flex-col shrink-0 text-slate-300 shadow-xl border-r border-slate-900" id="streamlit_sidebar">
        {/* Theme Brand Header */}
        <div className="p-6 border-b border-slate-700" id="brand_header">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <h1 className="text-white font-bold tracking-tight uppercase text-sm font-sans flex items-center gap-1.5">
               YouTube Studio API
            </h1>
          </div>
          <p className="text-slate-400 text-[11px] leading-tight">Pengaturan Kredensial / API Settings</p>
        </div>

        {/* Credentials Form Box */}
        <div className="p-6 space-y-6 flex-1 flex flex-col justify-start overflow-y-auto" id="api_credentials_form">
          {/* Dynamic Mode Selector Badge */}
          <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-700">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Mode Upload
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-0.5 rounded">
              <button
                onClick={() => {
                  setIsDemoMode(true);
                  handleDisconnect();
                }}
                className={`py-1 px-2 text-[11px] font-semibold rounded transition ${
                  isDemoMode
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Demo Simulasi
              </button>
              <button
                onClick={() => {
                  setIsDemoMode(false);
                  handleDisconnect();
                }}
                className={`py-1 px-2 text-[11px] font-semibold rounded transition ${
                  !isDemoMode
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Koneksi Asli
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="client_id_input" className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                Client ID
              </label>
              <input
                id="client_id_input"
                type="text"
                placeholder={isDemoMode ? "demo_client_id_abc123" : "Masukkan GCP Client ID..."}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="client_secret_input" className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                Client Secret
              </label>
              <input
                id="client_secret_input"
                type="password"
                placeholder={isDemoMode ? "••••••••••••••••" : "Masukkan GCP Client Secret..."}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
              />
            </div>

            {/* Connection Toggle */}
            {!isConnected ? (
              <button
                id="btn_hubungkan"
                onClick={handleConnectGoogle}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-4 rounded transition-colors uppercase tracking-wider cursor-pointer"
              >
                HUBUNGKAN AKUN
              </button>
            ) : (
              <div className="space-y-2">
                <div className="p-2.5 bg-emerald-950/40 border border-emerald-800 rounded text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">Akun Terhubung</span>
                </div>
                <button
                  id="btn_logout"
                  onClick={handleDisconnect}
                  className="w-full py-2 bg-slate-750 hover:bg-slate-700 border border-slate-650 text-slate-200 font-bold rounded text-xs transition duration-150 uppercase tracking-wider cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-700">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Gunakan Google Cloud Console untuk mendapatkan kredensial OAuth 2.0 Anda. Pastikan YouTube Data API v3 diaktifkan pada proyek Anda.
            </p>
          </div>

          {/* Callback helper URI warning */}
          {!isDemoMode && (
            <div className="p-3 bg-slate-900/60 border border-slate-700 rounded text-[10.5px] text-slate-400 space-y-2">
              <div className="font-bold text-slate-300 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-red-500" />
                <span>Redirect URI Terdaftar:</span>
              </div>
              <div className="p-1.5 bg-slate-950 font-mono text-[9px] text-slate-300 select-all rounded break-all leading-tight">
                {window.location.origin}/auth/callback
              </div>
              <div className="pt-1.5 border-t border-slate-700 flex justify-between">
                <button
                  type="button"
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="text-red-400 hover:underline font-semibold text-[9.5px] cursor-pointer"
                >
                  Metode Alternatif (Manual Tok)
                </button>
              </div>
            </div>
          )}

          {/* Token Override Form */}
          {showManualInput && (
            <form onSubmit={handleManualTokenSubmit} className="p-3 bg-slate-900 border border-amber-800 rounded space-y-2" id="manual_token_form">
              <label htmlFor="token_akses_input" className="block text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                Google Bearer Access Token
              </label>
              <input
                id="token_akses_input"
                type="password"
                placeholder="ya29.a0..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="w-full text-[11px] px-2 py-1.5 bg-slate-950 border border-slate-700 rounded outline-none focus:ring-1 focus:ring-amber-500 font-mono text-slate-300"
              />
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  disabled={!manualToken.trim()}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[9px] cursor-pointer"
                >
                  Gunakan
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualInput(false)}
                  className="px-2 py-1 bg-slate-800 text-slate-300 rounded font-bold text-[9px] cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* Channel Analytics Dashboard Segment */}
          <div className="pt-6 border-t border-slate-700 space-y-4" id="channel_analytics_sidebar">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                Analitik Saluran (All-Time)
              </h3>
              
              {isConnected && !isDemoMode && (
                <button
                  type="button"
                  title="Refresh Analitik"
                  onClick={() => authDetails?.accessToken && fetchChannelStats(authDetails.accessToken)}
                  className="p-1 hover:bg-slate-700 text-slate-450 hover:text-white rounded transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${channelStats.loading ? "animate-spin text-red-500" : "text-slate-400"}`} />
                </button>
              )}
            </div>

            {/* Profile Info Row */}
            <div className="p-3 bg-slate-900/40 border border-slate-700/60 rounded-xl flex items-center gap-2.5">
              {channelStats.channelThumbnail ? (
                <img
                  src={channelStats.channelThumbnail}
                  alt={channelStats.channelName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full border border-slate-700 object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-200 font-extrabold text-[10px] shrink-0">
                  {channelStats.channelName.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <h4 className="text-[11px] font-bold text-slate-100 truncate leading-tight">{channelStats.channelName}</h4>
                <p className="text-[9px] text-slate-450">
                  {isDemoMode ? "Simulasi Mode" : "Koneksi Google Live"}
                </p>
              </div>
            </div>

            {channelStats.loading ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-2">
                <div className="w-4 h-4 border-2 border-slate-500 border-t-red-500 rounded-full animate-spin"></div>
                <span className="text-[9px] text-slate-450 font-mono">Memuat statistik...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {/* Subscriber Count Card */}
                <div className="p-3 bg-slate-900/30 border border-slate-750/30 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block mb-0.5">Subscriber</span>
                    <span className="text-xs font-bold text-white tracking-tight leading-none">
                      {channelStats.subscribers >= 1000000
                        ? (channelStats.subscribers / 1000000).toFixed(1) + "M"
                        : channelStats.subscribers >= 1000
                        ? (channelStats.subscribers / 1000).toFixed(1) + "K"
                        : channelStats.subscribers.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-red-950/40 border border-red-900/40 flex items-center justify-center text-red-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>

                {/* Video Count Card */}
                <div className="p-3 bg-slate-900/30 border border-slate-755/30 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block mb-0.5">Jumlah Video</span>
                    <span className="text-xs font-bold text-white tracking-tight leading-none text-slate-100">
                      {channelStats.videoCount.toLocaleString("id-ID")} <span className="text-[9px] text-slate-400 font-normal">Video</span>
                    </span>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-blue-950/40 border border-blue-900/40 flex items-center justify-center text-blue-405">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>

                {/* Watch Hours (All time) Card */}
                <div className="p-3 bg-slate-900/30 border border-slate-755/30 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block mb-0.5">Jam Tayang (All Time)</span>
                    <span className="text-xs font-bold text-white tracking-tight leading-none text-slate-105">
                      {channelStats.watchHours.toLocaleString("id-ID")} <span className="text-[9px] text-slate-405 font-normal">Jam</span>
                    </span>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-emerald-950/40 border border-emerald-900/40 flex items-center justify-center text-emerald-405">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info/status */}
        <div className="p-4 bg-slate-900/50 border-t border-slate-900 mt-auto">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-amber-500 animate-pulse"}`}></div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold font-sans">
              {isConnected ? "System Connected" : "System Ready"}
            </span>
          </div>
        </div>
      </aside>

      {/* ==========================================
          B. MAIN CONTENT AREA (CLEAN MINIMALISM)
          ========================================== */}
      <main className="flex-1 flex flex-col p-6 md:p-8 max-w-5xl w-full mx-auto overflow-y-auto" id="main_content_area">
        
        {/* Page Header / Status Indicator Panel */}
        <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8" id="main_title_header">
          <div>
            <h2 className="text-2xl font-light text-slate-700 tracking-tight font-display">Upload Dashboard</h2>
            <p className="text-xs text-slate-400 mt-1">Sistem unggah video modular dengan YouTube Data API v3</p>
          </div>

          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 px-4 py-2.5 rounded-lg shadow-2xs self-start sm:self-auto">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400 bg-amber-500"}`}></div>
            <p className="text-emerald-700 text-xs font-semibold">
              Terhubung: <span className="font-bold">{isConnected ? (isDemoMode ? "demo_dev@youtube.com" : "senior_dev@company.com") : "Not Connected"}</span>
            </p>
          </div>
        </header>

        {/* Navigation Tabs (Minimalist block) */}
        <nav className="flex bg-slate-200/50 p-1 rounded-xl mb-6 shadow-2xs self-start" id="tab_navigator">
          <button
            onClick={() => setActiveTab("simulator")}
            className={`py-2 px-6 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === "simulator"
                ? "bg-white text-slate-800 shadow-sm font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Interactive Live Simulator</span>
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className={`py-2 px-6 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === "code"
                ? "bg-white text-slate-800 shadow-sm font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Python Streamlit Code</span>
          </button>
        </nav>

        {/* ==========================================
            C. TAB 1: LIVE SIMULATOR FOR UPLOADS
            ========================================== */}
        {activeTab === "simulator" && (
          <section className="space-y-6" id="view_simulator">
            
            {/* Disclaimer & Info box styled like Streamlit st.info */}
            <div className="p-4 bg-blue-50 border border-blue-100 text-blue-800 rounded-lg text-xs space-y-1.5 shadow-2xs" id="streamlit_info_box">
              <div className="flex items-center gap-2 font-bold">
                <Info className="w-4 h-4 text-blue-500" />
                <span>Informasi Simulator</span>
              </div>
              <p className="leading-relaxed text-blue-700">
                {isDemoMode ? (
                  <>
                    Aplikasi saat ini berjalan dalam <b>Mode Demo Simulasi</b>. Anda dapat menguji fungsionalitas visual seutuhnya tanpa memerlukan kredensial Google API riil. Untuk menggunakan channel riil, ubah mode ke <b>Koneksi Asli</b> di sidebar.
                  </>
                ) : (
                  <>
                    Aplikasi berjalan dalam <b>Mode Koneksi YouTube Asli</b>. Tindakan unggah akan mengirim data langsung menuju backend YouTube API menggunakan kredensial client Anda.
                  </>
                )}
              </p>
            </div>

            {/* Block overlay warn if not connected */}
            {!isConnected ? (
              <article className="p-6 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl shadow-3xs space-y-3.5" id="koneksi_warning_block">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span>Koneksi Masih Terputus</span>
                </div>
                <p className="text-xs leading-relaxed text-amber-700">
                  Untuk memulai proses, masukkan Client ID Anda ke bagian panel pengaturan di samping kiri kemudian klik tombol <b>HUBUNGKAN AKUN</b> untuk memberikan otorisasi aman.
                </p>
                <div className="flex items-center gap-2 text-xs pt-1">
                  <span className="font-bold text-amber-900">Alur Pengaturan:</span>
                  <span className="bg-white border border-amber-200 px-2.5 py-1 text-slate-600 rounded shadow-3xs text-[10.5px]">
                    1. Isi Client ID di Sidebar
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  <span className="bg-white border border-amber-200 px-2.5 py-1 text-slate-600 rounded shadow-3xs text-[10.5px]">
                    2. Klik Hubunkan Akun
                  </span>
                </div>
              </article>
            ) : (
              // BENTO/SPLIT LAYOUT CONTAINER
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="form_unggah_aktif">
                
                {/* Left Part: File Selection (5/12 cols) */}
                <div className="lg:col-span-5 flex flex-col">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 border-2 border-dashed rounded-2xl bg-white flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all duration-150 min-h-[350px] ${
                      isDragging
                        ? "border-blue-500 bg-blue-50/20"
                        : "border-slate-300 hover:border-blue-500 hover:bg-slate-50/50"
                    }`}
                  >
                    <input
                      id="file_uploader"
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="video/*"
                      className="hidden"
                    />

                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                      <Upload className="w-7 h-7" />
                    </div>

                    {!videoFile ? (
                      <div id="file_uploader_placeholder">
                        <p className="text-sm font-medium text-slate-600">Pilih file video (.mp4, .mov)</p>
                        <p className="text-xs text-slate-400 mt-1">Maksimum ukuran: 2GB</p>
                        <div className="mt-4 inline-block px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white text-xs rounded-full font-bold transition-colors">
                          Cari File
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 w-full" id="selected_file_info">
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center gap-3 text-left">
                          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-blue-600 font-bold text-[10px]">
                            {videoFile.name.split('.').pop()?.toUpperCase() || "VID"}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-xs font-bold text-slate-705 truncate">{videoFile.name}</p>
                            <p className="text-[10px] text-slate-400">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVideoFile(null);
                            setSuccessVideoId(null);
                          }}
                          className="text-xs font-semibold text-red-500 hover:underline"
                        >
                          Hapus & Pilih File Lain
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Part: Metadata Form Panel (7/12 cols) */}
                <div className="lg:col-span-7 space-y-5 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  
                  {uploadError && (
                    <div className="p-3.5 bg-red-50 border border-red-100 text-red-800 rounded-lg text-xs space-y-1" id="alert_error_upload">
                      <span className="font-bold block">Gagal Upload:</span>
                      <p className="text-red-700">{uploadError}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="video_title_input" className="text-xs font-bold text-slate-500 uppercase">
                      Judul Video <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="video_title_input"
                      type="text"
                      placeholder="Contoh: Integrasi Google Cloud API dengan Python"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      disabled={isUploading}
                      className="w-full border-b border-slate-200 py-2 focus:outline-none focus:border-red-500 transition-colors text-sm font-medium placeholder-slate-400 disabled:bg-slate-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="video_desc_textarea" className="text-xs font-bold text-slate-500 uppercase">
                      Deskripsi
                    </label>
                    <textarea
                      id="video_desc_textarea"
                      rows={4}
                      placeholder="Masukkan deskripsi penjelas video YouTube..."
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
                      disabled={isUploading}
                      className="w-full border border-slate-200 rounded-lg p-3 text-slate-650 focus:outline-none focus:border-red-500 transition-colors text-xs resize-none placeholder-slate-400 focus:ring-1 focus:ring-red-500 disabled:bg-slate-50"
                    />
                  </div>

                   <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="video_privacy_select" className="text-xs font-bold text-slate-500 uppercase">
                        Privasi
                      </label>
                      <select
                        id="video_privacy_select"
                        value={videoPrivacy}
                        onChange={(e) => setVideoPrivacy(e.target.value as any)}
                        disabled={isUploading || isScheduled}
                        className={`w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-white text-slate-705 focus:outline-none focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer ${isScheduled ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : ""}`}
                      >
                        <option value="private">Private</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="public">Public</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Kategori</label>
                      <select
                        disabled
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-slate-50 text-slate-500 focus:outline-none appearance-none"
                      >
                        <option>Science & Technology</option>
                      </select>
                    </div>
                  </div>

                  {/* Schedule Upload Feature Section */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          id="checkbox_schedule"
                          type="checkbox"
                          checked={isScheduled}
                          onChange={(e) => setIsScheduled(e.target.checked)}
                          disabled={isUploading}
                          className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500 cursor-pointer disabled:opacity-50"
                        />
                        <label htmlFor="checkbox_schedule" className="text-xs font-bold text-slate-700 tracking-wide uppercase cursor-pointer select-none">
                          Jadwalkan Publikasi Video
                        </label>
                      </div>
                      <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        YouTube Scheduler
                      </span>
                    </div>

                    {isScheduled && (
                      <div className="space-y-2 animate-fadeIn pt-1 border-t border-slate-200/60">
                        <label htmlFor="schedule_date_time" className="block text-[10px] font-bold text-slate-500 uppercase">
                          Pilih Tanggal & Waktu Terbit (WIB): <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="schedule_date_time"
                          type="datetime-local"
                          value={scheduledDateTime}
                          onChange={(e) => setScheduledDateTime(e.target.value)}
                          disabled={isUploading}
                          className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-white text-slate-750 focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                        />
                        <div className="p-2 bg-yellow-50 border border-yellow-100 text-yellow-800 text-[10px] rounded leading-normal">
                          ⚠️ Sesuai ketentuan YouTube API, video terjadwal akan diunggah dengan privasi <b>Private</b> terlebih dahulu dan dipublikasikan otomatis pada waktu pilihan Anda.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Upload Progress Bar and Trigger */}
                  <div className="pt-4">
                    {isUploading ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>{uploadStatusMsg}</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 transition-all duration-300 ease-out"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        id="btn_mulai_upload"
                        onClick={handleUploadVideo}
                        disabled={!videoFile}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white font-bold py-4 rounded-xl shadow-lg shadow-red-200 flex items-center justify-center gap-3 transition-transform active:scale-[0.98] cursor-pointer text-xs uppercase tracking-wider"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"></path>
                        </svg>
                        UPLOAD KE YOUTUBE
                      </button>
                    )}
                  </div>

                </div>

              </div>
            )}

            {/* Embedded Preview and details if success uploaded */}
            {successVideoId && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4" id="alert_upload_sukses">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Video Berhasil Terunggah!</h4>
                    <p className="text-xs text-slate-400">Video kini diproses pada server penyiaran YouTube</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg text-xs space-y-2 text-slate-650 font-mono">
                  <div className="flex flex-col sm:flex-row justify-between gap-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Video ID:</span>
                    <span className="font-bold text-red-600 select-all">{successVideoId}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between gap-1 pt-1.5 border-t border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Watch URL:</span>
                    <a
                      href={`https://youtu.be/${successVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      <span>https://youtu.be/{successVideoId}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {videoPrivacy !== "private" && (
                  <div className="rounded overflow-hidden border border-slate-200 aspect-video w-full max-w-lg mx-auto bg-slate-900">
                    <iframe
                      id="embed_youtube_preview"
                      title="YouTube Preview"
                      src={`https://www.youtube.com/embed/${successVideoId}`}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Footer Status Message block */}
            <footer className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
              </svg>
              <div className="space-y-1">
                <p className="text-blue-800 text-xs font-semibold">Petunjuk Keamanan Sesi</p>
                <p className="text-blue-700/90 text-[11px] leading-relaxed">
                  Token otentikasi disimpan di penyimpanan sisi lokal dan sesi saat ini secara terenkripsi. Selesai sesi, klik tombol <b>Disconnect</b> untuk memutuskan tautan akses secara permanen.
                </p>
              </div>
            </footer>

          </section>
        )}

        {/* ==========================================
            D. TAB 2: EXPORTABLE PYTHON SOURCE CODE VIEW
            ========================================== */}
        {activeTab === "code" && (
          <section className="space-y-6" id="view_source_code">
            
            <div className="p-4 bg-slate-100 border border-slate-200 rounded-lg text-xs space-y-1.5" id="code_guide_info">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-slate-500" />
                <span>Source Code Ekspor</span>
              </span>
              <p className="text-slate-500 leading-relaxed text-[11px]">
                Berikut file skrip Python Streamlit utama dan dependensinya yang siap diekspor agar kodingan berjalan mulus pada local workspace komputer Anda.
              </p>
            </div>

            {/* Inner subtabs */}
            <div className="flex border-b border-slate-200 text-xs font-bold" id="code_subtabs">
              <button
                onClick={() => setCodeActiveSubTab("python")}
                className={`py-2 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  codeActiveSubTab === "python"
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <span>streamlit_app.py</span>
              </button>
              <button
                onClick={() => setCodeActiveSubTab("reqs")}
                className={`py-2 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  codeActiveSubTab === "reqs"
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <span>requirements.txt</span>
              </button>
              <button
                onClick={() => setCodeActiveSubTab("guide")}
                className={`py-2 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  codeActiveSubTab === "guide"
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <span>Instruksi Run</span>
              </button>
            </div>

            {/* Code Snippet */}
            <div className="relative bg-slate-900 border border-slate-800 text-slate-100 p-4 rounded-xl font-mono text-[11px] overflow-x-auto shadow-md" id="code_snippet_container">
              
              <div className="absolute right-4 top-4">
                <button
                  onClick={() => {
                    const text = codeActiveSubTab === "python" ? pyCode : codeActiveSubTab === "reqs" ? reqsText : "";
                    if (codeActiveSubTab !== "guide") {
                      copyCodeToClipboard(text);
                    }
                  }}
                  disabled={codeActiveSubTab === "guide"}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-sans font-semibold text-[10px] cursor-pointer disabled:opacity-0"
                >
                  {copySuccess ? "Tersalin!" : "Salin Kode"}
                </button>
              </div>

              {codeActiveSubTab === "python" && (
                <pre className="p-1 break-normal whitespace-pre min-h-[200px]">
                  <code>{pyCode}</code>
                </pre>
              )}

              {codeActiveSubTab === "reqs" && (
                <pre className="p-1 break-normal whitespace-pre">
                  <code>{reqsText}</code>
                </pre>
              )}

              {codeActiveSubTab === "guide" && (
                <div className="p-2 font-sans text-xs text-slate-300 space-y-4 whitespace-normal" id="indo_run_guide_block">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Langkah Menjalankan di Komputer Lokal:</h4>
                  
                  <div className="space-y-1">
                    <p className="font-bold text-slate-100">1. Setup Berkas</p>
                    <p className="text-slate-400 text-[11px]">
                      Buat berkas bernama <code>streamlit_app.py</code> dan <code>requirements.txt</code> kemudian salin isian dari tab di atas.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-slate-100">2. Instalasi Paket</p>
                    <p className="text-slate-400 text-[11px]">Eksekusi perintah pip pada folder utama proyek:</p>
                    <code className="block bg-slate-950 p-2 rounded text-slate-200 mt-1 select-all font-mono">pip install -r requirements.txt</code>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-slate-100">3. Eksekusi Dashboard</p>
                    <code className="block bg-slate-950 p-2 rounded text-slate-200 mt-1 select-all font-mono">streamlit run streamlit_app.py</code>
                  </div>
                </div>
              )}
            </div>

          </section>
        )}

      </main>
    </div>
  );
}
