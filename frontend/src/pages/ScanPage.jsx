import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { QRCode } from "react-qr-code";
import { ArrowLeft, Image, QrCode } from "lucide-react";

export default function ScanPage() {
  const navigate = useNavigate();
  const { user, getMe } = useAuthStore();

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);

  const [showQR, setShowQR] = useState(false);
  const [ready, setReady] = useState(false);

  // Load user
  useEffect(() => {
    const load = async () => {
      if (!user) await getMe();
      setReady(true);
    };
    load();
  }, []);

  // Start scanner
  useEffect(() => {
    if (!ready || showQR) return;

    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          handleScan
        );
      } catch (err) {
        console.log("Camera error:", err);
      }
    };

    start();

    return () => stopScanner();
  }, [ready, showQR]);

  // Handle scan
  const handleScan = async (decodedText) => {
    try {
      const url = new URL(decodedText);
      const acc = url.searchParams.get("acc");

      if (!acc) return alert("Invalid QR");

      if (acc === user?.accountNumber) {
        return alert("Cannot scan your own QR");
      }

      await stopScanner();
      navigate(`/transfer?acc=${acc}`);
    } catch {
      alert("Invalid QR format");
    }
  };

  // Stop scanner
  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch (err) {
      console.log("Stop error:", err.message);
    }
  };

  // Actions
  const handleShowQR = async () => {
    await stopScanner();
    setShowQR(true);
  };

  const handleBackScan = () => setShowQR(false);

  const handleGalleryClick = async () => {
    await stopScanner();
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const scanner = new Html5Qrcode("file-reader");
      const decodedText = await scanner.scanFile(file, false);
      handleScan(decodedText);
    } catch (err) {
      console.log("File scan error:", err);
      alert("No QR found in image");
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-5 rounded-b-3xl shadow-lg flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-full bg-white/20"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold">
          {showQR ? "Receive Money" : "Scan QR"}
        </h1>
      </div>

      {/* CONTENT */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">

        <div className="bg-base-100 p-5 rounded-2xl shadow-md w-full max-w-sm text-center">

          {/* CAMERA OR QR */}
          {!showQR ? (
            <div
              id="reader"
              className="rounded-xl overflow-hidden"
              style={{ width: "100%" }}
            />
          ) : (
            <div className="flex flex-col items-center">
              {user ? (
                <div className="bg-white p-4 rounded-lg">
                  <QRCode
                    value={`bankapp://pay?acc=${user.accountNumber}`}
                    size={220}
                    level="M"
                  />
                </div>
              ) : (
                <p>Loading...</p>
              )}

              <p className="mt-3 text-sm opacity-70">
                Show this QR to receive money
              </p>
            </div>
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex gap-3 mt-6 w-full max-w-sm">

          {/* RECEIVE */}
          <button
            onClick={handleShowQR}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-500 text-white py-3 rounded-xl shadow hover:opacity-90"
          >
            <QrCode size={18} /> Receive
          </button>

          {/* UPLOAD QR IMAGE */}
          <button
            onClick={handleGalleryClick}
            className="flex-1 flex items-center justify-center gap-2 bg-base-100 border py-3 rounded-xl shadow"
          >
            <Image size={18} /> Upload QR
          </button>
        </div>

        {/* BACK BUTTON */}
        {showQR && (
          <button
            onClick={handleBackScan}
            className="mt-4 text-sm text-gray-500"
          >
            Back to Scan
          </button>
        )}
      </div>

      {/* HIDDEN INPUT */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {/* target for file-based scans, kept mounted regardless of view mode */}
      <div id="file-reader" style={{ display: "none" }} />
    </div>
  );
}