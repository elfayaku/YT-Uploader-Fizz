# -*- coding: utf-8 -*-
"""
Aplikasi YouTube Video Uploader berbasis Streamlit menggunakan YouTube Data API v3.
Dibuat dengan standar pengkodean bersih dan modular oleh Senior Python Developer.
Spesifikasi Teknis: streamlit, google-api-python-client, google-auth-oauthlib, google-auth-httplib2
"""

import os
import tempfile
import streamlit as st
import google_auth_oauthlib.flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

# 1. KONFIGURASI HALAMAN STREAMLIT
st.set_page_config(
    page_title="YouTube Streamlit Uploader",
    page_icon="🎥",
    layout="centered",
    initial_sidebar_state="expanded"
)

# Kustomisasi CSS ala Streamlit minimalist
st.markdown("""
<style>
    .main-header {
        font-family: 'Inter', sans-serif;
        font-weight: 700;
        color: #FF0000;
        margin-bottom: 5px;
    }
    .sub-header {
        font-family: 'Inter', sans-serif;
        color: #555555;
        margin-bottom: 25px;
    }
</style>
""", unsafe_allow_html=True)

# Scope API untuk mengupload video ke YouTube
SCOPES = ['https://www.googleapis.com/auth/youtube.upload']

# Inisialisasi Session State agar token tidak hilang selama sesi berjalan
if 'credentials' not in st.session_state:
    st.session_state.credentials = None
if 'oauth_flow' not in st.session_state:
    st.session_state.oauth_flow = None

# Header Utama
st.markdown("<h1 class='main-header'>🎥 YouTube Video Uploader</h1>", unsafe_allow_html=True)
st.markdown("<p class='sub-header'>Unggah video langsung ke channel Anda menggunakan API Kredensial sendiri.</p>", unsafe_allow_html=True)

# 2. SIDEBAR UNTUK PENGATURAN KREDENSIAL API
with st.sidebar:
    st.image("https://img.icons8.com/color/96/youtube-play.png", width=80)
    st.markdown("### Pengaturan Kredensial YouTube API")
    st.markdown("""
    Dapatkan **Client ID** dan **Client Secret** Anda dari [Google Cloud Console](https://console.cloud.google.com/).
    Pastikan Anda mengaktifkan **YouTube Data API v3** pada proyek Anda.
    """)
    
    # Input Kredensial dari Pengguna
    client_id = st.text_input("GCP Client ID", type="default", placeholder="Masukkan Client ID Anda...", value="")
    client_secret = st.text_input("GCP Client Secret", type="password", placeholder="Masukkan Client Secret Anda...", value="")
    
    st.markdown("---")
    
    # Tombol Hubungkan Akun
    if st.button("🔌 Hubungkan Akun YouTube", use_container_width=True):
        if not client_id or not client_secret:
            st.error("Silakan masukkan Client ID dan Client Secret terlebih dahulu!")
        else:
            # Membuat konfigurasi client secara dinamis dari input pengguna
            client_config = {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"]
                }
            }
            
            try:
                # Membuat flow auth menggunakan redirect_uri out-of-band (oob) untuk menyalin kode manual
                # Ini adalah cara paling aman untuk Streamlit yang dideploy di cloud
                flow = google_auth_oauthlib.flow.Flow.from_client_config(
                    client_config,
                    scopes=SCOPES,
                    redirect_uri='urn:ietf:wg:oauth:2.0:oob'
                )
                
                # Simpan flow ke session state
                st.session_state.oauth_flow = flow
                
                # Generate authorization URL
                auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')
                
                st.markdown("#### Langkah Otentikasi:")
                st.markdown(f"1. Buka [Link Otentikasi Ini]({auth_url}) untuk login dan memberi izin.")
                st.markdown("2. Salin kode otentikasi yang diberikan oleh Google.")
                
            except Exception as e:
                st.error(f"Gagal menginisialisasi OAuth: {e}")

    # Kolom untuk menginput kode verifikasi dari redirect Google
    if st.session_state.oauth_flow and not st.session_state.credentials:
        auth_code = st.text_input("Masukkan Kode Otentikasi Google:", type="password", help="Tempel kode otentikasi setelah login dari link di atas")
        
        if st.button("✅ Verifikasi & Selesaikan Koneksi", use_container_width=True):
            if auth_code:
                try:
                    flow = st.session_state.oauth_flow
                    flow.fetch_token(code=auth_code)
                    st.session_state.credentials = flow.credentials
                    st.success("Koneksi Akun Berhasil!")
                    st.rerun()
                except Exception as e:
                    st.error(f"Gagal verifikasi kode: {e}")
            else:
                st.warning("Silakan masukkan kode otentikasi terlebih dahulu.")

    # Status Koneksi di Sidebar
    st.markdown("### Status Koneksi")
    if st.session_state.credentials and st.session_state.credentials.valid:
        st.success("🟢 Terhubung ke YouTube")
        # Tombol Diskonek
        if st.button("⚠️ Putuskan Koneksi", use_container_width=True):
            st.session_state.credentials = None
            st.session_state.oauth_flow = None
            st.success("Koneksi diputuskan.")
            st.rerun()
    else:
        st.info("🔴 Belum Terhubung")

# 3. FORM INPUT & PROSES UPLOAD DI HALAMAN UTAMA
if st.session_state.credentials and st.session_state.credentials.valid:
    st.markdown("### 📤 Form Pengunggahan Video")
    
    # Pengunggah File Video
    uploaded_file = st.file_uploader("Pilih File Video (MP4, MKV, AVI, dll.)", type=["mp4", "mkv", "avi", "mov"])
    
    # Metadata Form
    video_title = st.text_input("Judul Video", placeholder="Masukkan judul video Anda...")
    video_description = st.text_area("Deskripsi Video", placeholder="Tuliskan deskripsi video di sini...")
    
    video_privacy = st.selectbox(
        "Privasi Video",
        options=["private", "public", "unlisted"],
        format_func=lambda x: x.capitalize(),
        index=0
    )
    
    # Tombol Upload
    if st.button("🚀 Mulai Unggah ke YouTube", use_container_width=True):
        if not uploaded_file:
            st.warning("Pilih file video terlebih dahulu!")
        elif not video_title:
            st.warning("Judul video tidak boleh kosong!")
        else:
            try:
                # Simpan berkas upload sementara karena YouTube API butuh file path di disk
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{uploaded_file.name.split('.')[-1]}") as tmp_file:
                    tmp_file.write(uploaded_file.read())
                    temp_file_path = tmp_file.name
                
                # Inisialisasi Service YouTube API
                youtube = build('youtube', 'v3', credentials=st.session_state.credentials)
                
                # Definisikan Meta Info Video
                body = {
                    'snippet': {
                        'title': video_title,
                        'description': video_description,
                        'tags': ['Streamlit', 'YouTube API', 'Uploader'],
                        'categoryId': '22'  # Kategori default: People & Blogs
                    },
                    'status': {
                        'privacyStatus': video_privacy,
                        'selfDeclaredMadeForKids': False
                    }
                }
                
                # Siapkan media upload chunked
                media = MediaFileUpload(
                    temp_file_path,
                    chunksize=1024 * 1024, # 1MB chunks
                    resumable=True
                )
                
                # Setup request upload
                request = youtube.videos().insert(
                    part=','.join(body.keys()),
                    body=body,
                    media_body=media
                )
                
                # Widget UI Progress
                progress_bar = st.progress(0)
                status_text = st.empty()
                status_text.text("Menyiapkan berkas untuk diunggah...")
                
                response = None
                while response is None:
                    status, response = request.next_chunk()
                    if status:
                        progress = int(status.progress() * 100)
                        progress_bar.progress(progress)
                        status_text.text(f"Mengunggah... {progress}% selesai")
                
                progress_bar.progress(100)
                status_text.text("Proses unggah selesai!")
                
                # Berhasil! Tampilkan Video ID & Link
                video_id = response.get('id')
                if video_id:
                    st.success(f"🎉 Berhasil Mengunggah Video!")
                    st.markdown(f"**Video ID:** `{video_id}`")
                    st.markdown(f"**Tautan Video:** [https://youtu.be/{video_id}](https://youtu.be/{video_id})")
                    
                    # Embed preview jika video public/unlisted
                    if video_privacy != "private":
                        st.subheader("Preview Video:")
                        st.video(f"https://youtu.be/{video_id}")
                else:
                    st.error("Gagal mendapatkan Video ID, namun unggahan selesai tanpa error.")
                
                # Bersihkan file temporer
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
                    
            except Exception as e:
                st.error(f"Terjadi kesalahan saat mengunggah: {e}")
                
else:
    # Tampilan jika belum login
    st.warning("⚠️ Akun Belum Terhubung")
    st.info("Silakan lengkapi Client ID & Client Secret di sidebar sebelah kiri, kemudian klik tombol **Hubungkan Akun YouTube** untuk memulai.")
    
    st.markdown("### Cara Kerja Aplikasi:")
    cols = st.columns(3)
    with cols[0]:
        st.markdown("🔑 **1. Konfigurasi Kredensial**")
        st.caption("Masukkan detail OAuth Client ID & Secret yang didapat dari Google Cloud Console ke panel sidebar.")
    with cols[1]:
        st.markdown("🔌 **2. Log In & Izin**")
        st.caption("Klik Hubungkan Akun, selesaikan instruksi izin di jendela browser Anda, lalu masukkan kodenya.")
    with cols[2]:
        st.markdown("📤 **3. Unggah Berkas**")
        st.caption("Setelah terhubung, Anda dapat melengkapi informasi video dan mengunggahnya langsung ke YouTube.")
