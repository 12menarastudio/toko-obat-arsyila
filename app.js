// ==========================================
// 1. CORE ENGINE: MEMORI & DATA MANAJEMEN
// ==========================================
const rupiah = (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

function getTanggalLokal(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Variabel State Utama (Database Virtual)
let masterItems = [];
let etalaseItems = [];
let cashierHistory = [];
let profilApotek = { nama: "APOTEK ARSYILA", alamat: "Desa Bahari Dua, Buton Selatan", telepon: "081234567890" };
let siklusAktif = { modalAwal: 0, qtyAwal: 0, modalTambahan: 0, qtyTambahan: 0, uangMasuk: 0, tanggalStart: getTanggalLokal() };
let notifikasiHistori = []; // DATABASE NOTIFIKASI TAMBAHAN

// TUGAS QW-1: SENTRALISASI PENYIMPANAN LOCAL STORAGE (ANTI-CRASH & DRY)
function saveApotekDB(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error("Gagal menyimpan data:", e);
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            alert('Peringatan: Memori browser penuh! Silakan hapus riwayat transaksi lama atau tutup buku untuk membebaskan ruang.');
        }
    }
}

// TUGAS QW-2: SENTRALISASI HAPTIC FEEDBACK (VIBRASI)
function triggerHaptic(pattern = 100) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}

// Memuat data dari Memori Perangkat (Local Storage)
try { 
    let parsedNotif = JSON.parse(localStorage.getItem('apotek_notifikasi'));
    if (Array.isArray(parsedNotif)) notifikasiHistori = parsedNotif;
    
    let parsedMaster = JSON.parse(localStorage.getItem('apotek_masterItems'));
    if (Array.isArray(parsedMaster) && parsedMaster.length > 0) masterItems = parsedMaster;
        
    let parsedEtalase = JSON.parse(localStorage.getItem('apotek_etalaseItems'));
    if (Array.isArray(parsedEtalase)) etalaseItems = parsedEtalase;
        
    let parsedCashier = JSON.parse(localStorage.getItem('apotek_cashierHistory'));
    if (Array.isArray(parsedCashier)) cashierHistory = parsedCashier;
    
    let parsedSiklus = JSON.parse(localStorage.getItem('apotek_siklusAktif'));
    if (parsedSiklus) siklusAktif = parsedSiklus;
    
    if (!siklusAktif.tanggalStart) siklusAktif.tanggalStart = getTanggalLokal();
} catch(e) { console.error("Gagal memuat memori", e); }

// ==========================================
// 2. NAVIGASI LAYAR (ROUTING)
// ==========================================
function bukaLayar(targetLayar) {
    // Sembunyikan semua layar
    document.querySelectorAll('.layar-app').forEach(layar => layar.classList.add('hidden'));
        
    // Tampilkan layar yang dituju
    const layarAktif = document.getElementById('layar-' + targetLayar);
    if(layarAktif) layarAktif.classList.remove('hidden');
    
    // Ubah warna ikon di navigasi bawah
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if(btn.dataset.target === targetLayar) { 
             btn.classList.replace('text-slate-400', 'text-corporate-600'); 
         } else { 
             btn.classList.replace('text-corporate-600', 'text-slate-400'); 
         }
    });
    
    // [PENYEMPURNAAN UX] Hapus isi kolom pencarian otomatis jika pindah layar secara manual
    if (targetLayar === 'piutang') { let s = document.getElementById('cariPiutangMobile'); if(s) s.value = ''; }
    if (targetLayar === 'gudang') { let s = document.getElementById('cariGudangMobile'); if(s) s.value = ''; }
    if (targetLayar === 'etalase') { let s = document.getElementById('cariEtalaseMobile'); if(s) s.value = ''; }
    
    // Jalankan fungsi render sesuai layar yang dibuka
    if (targetLayar === 'beranda') renderBerandaMobile();
    if (targetLayar === 'rekap') renderRekapMobile();
    if (targetLayar === 'gudang') renderGudangMobile(document.getElementById('cariGudangMobile').value);
    if (targetLayar === 'riwayat') renderRiwayatMobile();
    if (targetLayar === 'piutang') renderPiutangMobile();
    if (targetLayar === 'etalase') renderEtalaseMobile();
    if (targetLayar === 'laporan') renderLaporanMobile();
}

// ==========================================
// 3. MESIN RENDER: BERANDA
// ==========================================
function renderBerandaMobile() {
    let tglHariIni = getTanggalLokal();
    let omzet = 0, laba = 0, hpp = 0, daftarTerlaris = {}, totalKasbonBelumLunas = 0;
    let totalItemTerjualHariIni = 0, totalPembeliHariIni = 0; // TAMBAHAN VARIABEL BARU
    
    let totalPelunasan = 0; // TAMBAHAN: Untuk melacak uang masuk dari utang
    cashierHistory.forEach(t => {
        if (t.tanggal === tglHariIni) {
            if (!t.isPelunasan) {
                omzet += t.total || 0; laba += t.laba || 0; hpp += ((t.total || 0) - (t.laba || 0));
                totalItemTerjualHariIni += (t.item || 0); 
                totalPembeliHariIni++; 
            } else {
                totalPelunasan += t.total || 0; // Hanya catat sebagai kas masuk, bukan omzet
            }
        }
        if (t.metode === 'Debt' && !t.statusLunas) totalKasbonBelumLunas++;
        if (!t.isPelunasan) {
            if (daftarTerlaris[t.obat]) { 
                 daftarTerlaris[t.obat].item += t.item || 0; 
                 daftarTerlaris[t.obat].omset += t.total || 0; 
             } else { 
                 daftarTerlaris[t.obat] = { nama: t.obat, item: t.item || 0, omset: t.total || 0 }; 
             }
        }
    });
    
  document.getElementById('berandaOmzet').textContent = rupiah(Math.round(omzet));
    document.getElementById('berandaHPP').textContent = '- ' + rupiah(Math.round(hpp));
    document.getElementById('berandaLaba').textContent = rupiah(Math.round(laba));
    
    // INJEKSI UI: Menampilkan Pelunasan agar kasir tahu uang masuk hari ini
    if(document.getElementById('berandaPelunasan')) {
        document.getElementById('berandaPelunasan').textContent = '+ ' + rupiah(totalPelunasan);
        document.getElementById('wadahPelunasan').classList.toggle('hidden', totalPelunasan === 0);
    }

    let asetGudang = 0, totalJenisObat = 0, countKritis = 0, countExpired = 0, stokGabungan = {};
    let totalSisaStok = 0; // TAMBAHAN VARIABEL STOK
    
    masterItems.forEach(b => {
        if (b.nama !== '___SYSTEM_AUTH___') {
            asetGudang += (b.modal || 0) * (b.stok || 0);
            if (!stokGabungan[b.dnaInduk]) { stokGabungan[b.dnaInduk] = 0; totalJenisObat++; }
            stokGabungan[b.dnaInduk] += b.stok;
            totalSisaStok += b.stok; // MENGHITUNG STOK GUDANG
            
            if (b.expired) {
                let diffHari = Math.floor((new Date(b.expired) - new Date(tglHariIni)) / (1000 * 60 * 60 * 24));
                if (diffHari <= 30 && diffHari >= 0) countExpired++;
            }
        }
    });
    Object.values(stokGabungan).forEach(totalStok => { if (totalStok <= 2) countKritis++; });
    
    let asetEtalase = 0;
    etalaseItems.forEach(b => {
        // MENGHITUNG STOK ETALASE
        if (!stokGabungan[b.dnaInduk]) { stokGabungan[b.dnaInduk] = 0; totalJenisObat++; }
        stokGabungan[b.dnaInduk] += (b.stok || 0);
        totalSisaStok += (b.stok || 0); 
        
        if(b.antreanFIFO && b.antreanFIFO.length > 0) {
            b.antreanFIFO.forEach(fifo => { asetEtalase += ((fifo.modal || 0) * (fifo.stok || 0)); });
        } else {
            let masterNya = masterItems.find(m => m.dnaInduk === b.dnaInduk || m.nama === b.nama); 
             asetEtalase += (masterNya ? (masterNya.modal || 0) : 0) * (b.stok || 0);
        }
    });

    // --- 1. KALKULASI ASET FISIK SAAT INI (KARTU 4 FASE) ---
    let asetGudangFase = 0; let stokGudangFase = 0;
    masterItems.forEach(i => { if (i.nama !== '___SYSTEM_AUTH___' && i.kategori !== 'тЪая╕П Barang Retur') { asetGudangFase += (i.modal || 0) * (i.stok || 0); stokGudangFase += (i.stok || 0); } });
    
    let asetEtalaseFase = 0; let stokEtalaseFase = 0;
    etalaseItems.forEach(i => {
        let hpp = i.antreanFIFO && i.antreanFIFO.length > 0 ? i.antreanFIFO[0].modal : 0;
        if(!hpp) { let masterNya = masterItems.find(m => m.dnaInduk === i.dnaInduk || m.nama === i.nama); hpp = masterNya ? (masterNya.modal || 0) : 0; }
        asetEtalaseFase += (hpp * (i.stok || 0)); stokEtalaseFase += (i.stok || 0);
    });
    
    let totalAsetFisik = asetGudangFase + asetEtalaseFase;
    let totalStokFisik = stokGudangFase + stokEtalaseFase;
    
    // --- 2. LOGIKA KARTU MULTI-FASE (DEFISIT vs LIKUIDASI) ---
    let topModalMurni = (siklusAktif.modalAwal || 0) + (siklusAktif.modalTambahan || 0);
    let topQtyMurni = (siklusAktif.qtyAwal || 0) + (siklusAktif.qtyTambahan || 0);
    let tercapai = siklusAktif.uangMasuk || 0;
    
    // Mesin Pencari Target Hutang (Baca Hutang Bawaan atau Modal Murni)
    let targetHutang = (siklusAktif.hutangAwal !== undefined ? siklusAktif.hutangAwal : (siklusAktif.modalAwal || 0)) + (siklusAktif.modalTambahan || 0);
    
    let labelBawah = document.getElementById('berandaStatusSiklus');
    let progressBar = document.getElementById('berandaProgressSiklus');

    if (siklusAktif.isLikuidasi) {
        // 🟢 FASE LIKUIDASI (Gambar 4 - Habiskan Sisa Profit)
        if (document.getElementById('berandaTotalStokMasuk')) document.getElementById('berandaTotalStokMasuk').textContent = totalStokFisik + " Stok Persediaan";
        document.getElementById('berandaAset').textContent = rupiah(totalAsetFisik);
        let patokanAwal = siklusAktif.modalAwal || 1; 
        let persenLikuidasi = 100 - ((totalAsetFisik / patokanAwal) * 100);
        if (persenLikuidasi < 0) persenLikuidasi = 0; if (totalAsetFisik <= 0) persenLikuidasi = 100;
        if (labelBawah) labelBawah.innerHTML = `Persediaan Awal: <span class="text-emerald-500 font-black">${rupiah(totalAsetFisik)}</span>`;
        if (progressBar) { progressBar.className = "h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000"; progressBar.style.width = persenLikuidasi + "%"; }
    } else {
        // 🔴/🟡/🟢 FASE STANDAR & LANJUTAN DEFISIT (Gambar 1, 2, 5, 6, 7)
        let teksAtasLabel = siklusAktif.isLanjutanDefisit ? "Stok Terakhir" : "Stok Dibeli";
        if (document.getElementById('berandaTotalStokMasuk')) document.getElementById('berandaTotalStokMasuk').textContent = topQtyMurni + " " + teksAtasLabel;
        document.getElementById('berandaAset').textContent = rupiah(topModalMurni);
        
        if (targetHutang === 0 && tercapai === 0) {
            // NOL MODAL (Gambar 2)
            if (labelBawah) labelBawah.innerHTML = `Sisa Target Balik Modal: <span class="text-red-500 font-black">Rp 0</span>`;
            if (progressBar) { progressBar.className = "h-full bg-gradient-to-r from-red-500 to-amber-400 rounded-full transition-all duration-1000"; progressBar.style.width = "0%"; }
        } else if (tercapai < targetHutang) {
            // DEFISIT (Gambar 7 & Default)
            let sisaHutang = targetHutang - tercapai; 
            let persen = topModalMurni === 0 ? 0 : Math.max(0, ((topModalMurni - sisaHutang) / topModalMurni) * 100);
            if (labelBawah) labelBawah.innerHTML = `Sisa Target Balik Modal: <span class="text-red-500 font-black">${rupiah(sisaHutang)}</span>`;
            if (progressBar) { progressBar.className = "h-full bg-gradient-to-r from-red-500 to-amber-400 rounded-full transition-all duration-1000"; progressBar.style.width = persen + "%"; }
        } else if (tercapai === targetHutang && targetHutang > 0) {
            // IMPAS (Gambar 5)
            if (labelBawah) labelBawah.innerHTML = `<div class="bg-amber-500 text-white px-3 py-1 rounded-lg font-black shadow-sm text-[10px] tracking-widest uppercase flex items-center justify-center gap-1.5 w-full"><i class="fa-solid fa-scale-balanced text-sm"></i> STATUS KEMBALI MODAL</div>`;
            if (progressBar) { progressBar.className = "h-full bg-amber-400 rounded-full transition-all duration-1000"; progressBar.style.width = "100%"; }
        } else {
            // SURPLUS (Gambar 6)
            let untung = tercapai - targetHutang;
            if (labelBawah) labelBawah.innerHTML = `<div class="bg-emerald-600 text-white px-3 py-1 rounded-lg font-black shadow-sm text-[10px] tracking-widest uppercase flex items-center justify-center gap-1.5 w-full"><i class="fa-solid fa-circle-check text-sm"></i> ANDA TELAH UNTUNG: ${rupiah(untung)}</div>`;
            if (progressBar) { progressBar.className = "h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000"; progressBar.style.width = "100%"; }
        }
    }

    let arrTerlaris = Object.values(daftarTerlaris).sort((a, b) => b.item - a.item).slice(0, 3);
    const wadahTerlaris = document.getElementById('wadahObatTerlaris');
    
    if(arrTerlaris.length === 0) {
        wadahTerlaris.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs font-bold"><i class="fa-solid fa-box-open text-3xl mb-2 block opacity-50"></i><br>Belum ada penjualan</div>`;
    } else {
        wadahTerlaris.innerHTML = arrTerlaris.map((ob, idx) => {
            let styling = idx === 0 ? 'bg-amber-100 text-amber-600 border-amber-200' : (idx === 1 ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-orange-50 text-orange-600 border-orange-200');
            return `<div class="flex items-center gap-3 p-3 hover:bg-slate-50 transition"><div class="w-8 h-8 rounded-full ${styling} flex items-center justify-center font-black text-sm shrink-0 border">${idx + 1}</div><div class="flex-1 overflow-hidden"><h4 class="font-bold text-slate-800 text-sm truncate">${ob.nama}</h4><p class="text-[10px] text-slate-500 mt-0.5">${ob.item} Terjual</p></div><div class="text-right shrink-0"><p class="font-bold text-corporate-700 text-sm">${rupiah(ob.omset)}</p></div></div>`;
        }).join('');
    }
    
    document.getElementById('berandaKritis').textContent = countKritis;
    document.getElementById('berandaKasbon').textContent = totalKasbonBelumLunas;
    document.getElementById('berandaKedaluwarsa').textContent = countExpired;
    
    // MENGIRIM DATA KE KOTAK BARU
    if (document.getElementById('berandaSisaStok')) document.getElementById('berandaSisaStok').textContent = totalSisaStok;
    if (document.getElementById('berandaObatTerjual')) document.getElementById('berandaObatTerjual').textContent = totalItemTerjualHariIni;
    if (document.getElementById('berandaPembeli')) document.getElementById('berandaPembeli').textContent = totalPembeliHariIni;
    if (document.getElementById('berandaJenis')) document.getElementById('berandaJenis').textContent = totalJenisObat;
    if (document.getElementById('berandaJenisObat')) document.getElementById('berandaJenisObat').textContent = `${totalJenisObat} Obat Terdaftar`;

    // INJEKSI ANGKA KE PANEL TIGA SERANGKAI EMAS
    let terjualSiklusIni = 0;
    let waktuMulaiSiklus = siklusAktif.waktuStart || 0;
    
    cashierHistory.forEach(t => {
        if (t.id >= waktuMulaiSiklus && !t.isPelunasan) {
            terjualSiklusIni += (t.item || 0);
        }
    });
    
    if (document.getElementById('panelStokSisa')) document.getElementById('panelStokSisa').textContent = totalSisaStok;
    if (document.getElementById('panelStokTerjual')) document.getElementById('panelStokTerjual').textContent = terjualSiklusIni;
    
    // --- LOGIKA BARU BATANG EMAS (AKUMULATIF VS LIKUIDASI) ---
    let angkaStokModal = 0;
    if (siklusAktif.isLikuidasi) {
        // JIKA SURPLUS: Lupakan masa lalu, Stok Modal murni 0 atau hanya membaca barang baru (Kulakan)
        angkaStokModal = siklusAktif.qtyTambahan || 0;
    } else {
        // JIKA DEFISIT & NORMAL: Akumulasikan seluruh pondasi fisik (Lama + Baru) secara utuh
        angkaStokModal = (siklusAktif.qtyAwal || 0) + (siklusAktif.qtyTambahan || 0);
    }
    if (document.getElementById('panelStokTotal')) document.getElementById('panelStokTotal').textContent = angkaStokModal;
    
    // KEMBALIKAN SCROLL KE KIRI (KOTAK PERTAMA) SAAT BERANDA DIBUKA
    const scrollPantauan = document.getElementById('wadahPantauanSistem');
    if (scrollPantauan) {
        scrollPantauan.scrollLeft = 0;
    }
}

// ==========================================
// 4. MESIN RENDER: GUDANG & ETALASE
// ==========================================
function renderGudangMobile(filter = '') {
    const wadah = document.getElementById('daftarGudangMobile');
    const f = filter.toLowerCase().trim();
    
    let dataTampil = masterItems.filter(i => i.nama !== '___SYSTEM_AUTH___' && i.kategori !== '⚠️ Barang Retur' && (
        i.nama.toLowerCase().includes(f) || (i.kategori && i.kategori.toLowerCase().includes(f)) || (i.varian && i.varian.toLowerCase().includes(f))
    ));
    
    if (dataTampil.length === 0) {
        wadah.innerHTML = `<div class="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm mt-4"><i class="fa-solid fa-box-open text-4xl text-slate-300 mb-3 block"></i><p class="text-sm font-bold text-slate-500">Tidak ada obat ditemukan.</p></div>`;
        return;
    }

    // --- LOGIKA MESIN: PENGUMPUL DATA TERJUAL & ETALASE ---
    let terjualGlobal = {};
    let waktuMulai = siklusAktif.waktuStart || 0;
    
    cashierHistory.filter(t => !t.isPelunasan && t.id >= waktuMulai).forEach(trx => {
        if(trx.detailKeranjang) {
            trx.detailKeranjang.forEach(item => { terjualGlobal[item.nama] = (terjualGlobal[item.nama] || 0) + item.qty; });
        } else {
            terjualGlobal[trx.obat] = (terjualGlobal[trx.obat] || 0) + (trx.item || 1);
        }
    });
    
    let stokEtalaseGlobal = {};
    etalaseItems.forEach(e => { stokEtalaseGlobal[e.nama] = (stokEtalaseGlobal[e.nama] || 0) + e.stok; });
    
    let grouped = {};
    dataTampil.forEach(i => {
        if(!grouped[i.dnaInduk]) {
            grouped[i.dnaInduk] = { dnaInduk: i.dnaInduk, nama: i.nama, varian: i.varian, kategori: i.kategori, jual: i.jual, totalStok: 0, batches: [] };
        }
        grouped[i.dnaInduk].batches.push(i);
        grouped[i.dnaInduk].totalStok += i.stok;
    });

    wadah.innerHTML = Object.values(grouped).map(g => {
        g.batches.sort((a, b) => new Date(a.expired || '2099-12-31') - new Date(b.expired || '2099-12-31'));
        
        let subTeks = g.varian ? `<span class="text-[9px] text-slate-400 font-medium ml-1.5 border-l border-slate-300 pl-1.5">${g.varian}</span>` : '';
        
        // --- KALKULASI TIGA SERANGKAI STOK ---
        let qtyTerjual = terjualGlobal[g.nama] || 0;
        let qtyEtalase = stokEtalaseGlobal[g.nama] || 0;
        let sisaFisik = g.totalStok + qtyEtalase;
        
        let qtyAwal = 0;
        if (siklusAktif.isLikuidasi) {
            // SURPLUS (LIKUIDASI): Potong dengan foto lama, kembalikan ke 0 (kecuali ada kulakan baru)
            let snap = (siklusAktif.snapshotStok && siklusAktif.snapshotStok[g.dnaInduk]) ? siklusAktif.snapshotStok[g.dnaInduk] : 0;
            qtyAwal = (sisaFisik + qtyTerjual) - snap;
            if (qtyAwal < 0) qtyAwal = 0;
        } else {
            // DEFISIT & NORMAL: Jangan potong! Akumulasikan sisa fisik murni + terjual
            qtyAwal = sisaFisik + qtyTerjual; 
        } 
        
        // Cetakan Daftar Batch (Dibuat lebih langsing dan transparan)
        let batchHtml = g.batches.map((b, idx) => {
            let expTeks = b.expired ? b.expired : 'Tanpa Exp';
            let expColor = b.expired ? 'text-red-500 font-bold' : 'text-slate-400';
            return `
            <div class="flex items-center justify-between text-[10px] bg-slate-50/50 border border-slate-100 px-3 py-1.5 rounded-lg">
                <div class="text-slate-500 font-semibold"><span class="text-slate-400 mr-1 text-[9px]">BATCH ${idx+1}</span> <span class="text-slate-300 mx-1">|</span> Exp: <span class="${expColor}">${expTeks}</span></div>
                <div class="text-slate-600 font-bold flex gap-2">
                    <span>Sisa: <span class="text-emerald-600">${b.stok}</span></span>
                    <span class="text-slate-300">|</span>
                    <span>Beli: <span class="text-red-400">${rupiah(Math.round(b.modal))}</span></span>
                </div>
            </div>`;
        }).join('<div class="h-1"></div>');
        
        return `
        <div class="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm relative overflow-hidden group">
            <div class="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                <div class="flex-1 pr-2">
                    <h3 class="font-black text-slate-800 text-lg leading-tight flex items-center gap-2">${g.nama} ${subTeks}</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">${g.kategori || 'Tanpa Kategori'}</p>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Harga Jual</p>
                    <p class="font-black text-corporate-700 text-base leading-none">${rupiah(g.jual)}</p>
                </div>
            </div>
            
            <div class="flex items-center justify-between border-y border-slate-100 py-2.5 my-3">
                <div class="flex-1 text-center bg-slate-100 py-2 rounded-xl border border-slate-200 mr-1 shadow-inner">
                    <p class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><i class="fa-solid fa-boxes-stacked"></i> Stok Modal</p>
                    <p class="text-sm font-black text-slate-800 leading-none">${qtyAwal}</p>
                </div>
                <div class="flex-1 text-center border-r border-slate-100">
                    <p class="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><i class="fa-solid fa-cart-arrow-down"></i> Terjual</p>
                    <p class="text-sm font-black text-amber-600 leading-none drop-shadow-sm">${qtyTerjual}</p>
                </div>
                <div class="flex-1 text-center animate-pulse">
                    <p class="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><i class="fa-solid fa-check-circle"></i> Stok Gudang</p>
                    <p class="text-sm font-black text-emerald-600 leading-none drop-shadow-sm">${g.totalStok}</p>
                </div>
            </div>
            
            <div class="mb-4">
                ${batchHtml}
            </div>
            
            <div class="flex gap-2">
                <button onclick="bukaModalTransferMobile('${g.dnaInduk}')" class="flex-1 h-10 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-500 hover:text-white text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm">
                    <i class="fa-solid fa-truck-fast text-sm"></i> Ke Etalase
                </button>
                <button onclick="bukaModalEditMobile('${g.batches[0].idBatch}')" class="w-12 h-10 bg-white text-corporate-600 hover:bg-corporate-50 border border-slate-200 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="bukaModalHapusCerdas('${g.dnaInduk}', '${g.nama}')" class="w-12 h-10 bg-white text-red-500 hover:bg-red-50 border border-slate-200 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

function renderEtalaseMobile() {
    const wadah = document.getElementById('daftarEtalaseMobile');
    const f = (document.getElementById('cariEtalaseMobile').value || '').toLowerCase().trim();
    
    let etalaseAktif = etalaseItems.filter(i => i.stok > 0 && (i.nama.toLowerCase().includes(f) || (i.kategori && i.kategori.toLowerCase().includes(f))));
    
    if (etalaseAktif.length === 0) {
        wadah.innerHTML = `<div class="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm mt-4"><i class="fa-solid fa-inbox text-4xl text-slate-300 mb-3 block"></i><p class="font-bold text-slate-600">Etalase kosong.</p><p class="text-[10px] text-slate-400 mt-1">Transfer obat dari Gudang ke sini.</p></div>`;
        return;
    }
    
    wadah.innerHTML = etalaseAktif.map(i => {
        let subTeks = i.varian ? `<span class="text-[9px] text-slate-400 font-medium ml-1.5 border-l border-slate-300 pl-1.5">${i.varian}</span>` : '';
        return `
        <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
            <div class="flex-1 pr-2 border-r border-slate-100">
                <h3 class="font-black text-slate-800 text-sm leading-tight flex items-center">${i.nama}${subTeks}</h3>
                <p class="text-[10px] text-corporate-500 font-bold uppercase tracking-widest mt-1.5">${i.kategori || 'Tanpa Kategori'}</p>
            </div>
            <div class="flex flex-col items-end shrink-0 pl-1">
                <p class="font-black text-corporate-700 text-base mb-1">${rupiah(i.jual)}</p>
                <div class="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-inner">
                    <i class="fa-solid fa-boxes-stacked text-[9px]"></i><span class="font-black text-xs">${i.stok}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ==========================================
// 5. MESIN RIWAYAT CERDAS (SELEKSI, BINTANG & ARSIP)
// ==========================================
let riwayatTabAktifMobile = 'semua';
let modeSeleksiRiwayatAktif = false;
let itemTerpilihRiwayat = [];
let timerLongPressRiwayat;

function ubahTabRiwayat(tab) {
    riwayatTabAktifMobile = tab;
    batalSeleksiRiwayat(); 
        
    ['semua', 'bintang', 'arsip'].forEach(t => {
        let btn = document.getElementById('tabRiwayat-' + t);
        if(t === tab) {
            btn.className = (t === 'semua') ? "px-4 py-2 rounded-xl text-[11px] font-black bg-white text-corporate-700 shadow-sm transition-all uppercase tracking-wider" : "px-3.5 py-2 rounded-xl text-[11px] font-bold bg-white shadow-sm transition-all";
        } else {
            btn.className = (t === 'semua') ? "px-4 py-2 rounded-xl text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-all uppercase tracking-wider" : "px-3.5 py-2 rounded-xl text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-all";
        }
    });
    renderRiwayatMobile();
}

function mulaiTekanRiwayat(id) {
    if(modeSeleksiRiwayatAktif) return; 
    timerLongPressRiwayat = setTimeout(() => {
        triggerHaptic(100);
        aktifkanModeSeleksiRiwayat(id);
    }, 500);
}

function lepasTekanRiwayat() { clearTimeout(timerLongPressRiwayat); }

function klikItemRiwayat(id) {
    if(modeSeleksiRiwayatAktif) { togglePilihRiwayat(id); }
}

function aktifkanModeSeleksiRiwayat(idPertama) {
    modeSeleksiRiwayatAktif = true; itemTerpilihRiwayat = [idPertama];
    document.getElementById('headerNormalRiwayat').classList.add('hidden');
    document.getElementById('headerSeleksiRiwayat').classList.remove('hidden');
    renderRiwayatMobile();
}

function batalSeleksiRiwayat() {
    modeSeleksiRiwayatAktif = false; itemTerpilihRiwayat = [];
    document.getElementById('headerSeleksiRiwayat').classList.add('hidden');
    document.getElementById('headerNormalRiwayat').classList.remove('hidden');
    renderRiwayatMobile();
}

function togglePilihRiwayat(id) {
    let idx = itemTerpilihRiwayat.indexOf(id);
    if(idx !== -1) itemTerpilihRiwayat.splice(idx, 1);
    else itemTerpilihRiwayat.push(id);
    
    if(itemTerpilihRiwayat.length === 0) batalSeleksiRiwayat();
    else { document.getElementById('teksJumlahSeleksi').textContent = itemTerpilihRiwayat.length + " Dipilih"; renderRiwayatMobile(); }
}

function pilihSemuaRiwayat() {
    let tglFilter = document.getElementById('filterTglRiwayatMobile').value;
    let dataTampil = cashierHistory.filter(t => t.tanggal === tglFilter);
    if(riwayatTabAktifMobile === 'semua') dataTampil = dataTampil.filter(t => !t.isArsip);
    else if(riwayatTabAktifMobile === 'bintang') dataTampil = dataTampil.filter(t => t.isBintang && !t.isArsip);
    else if(riwayatTabAktifMobile === 'arsip') dataTampil = dataTampil.filter(t => t.isArsip);
    itemTerpilihRiwayat = dataTampil.map(t => t.id);
    document.getElementById('teksJumlahSeleksi').textContent = itemTerpilihRiwayat.length + " Dipilih";
    renderRiwayatMobile();
}

function prosesBintangMasalRiwayat() {
    if(itemTerpilihRiwayat.length === 0) return;
    cashierHistory.forEach(t => { if(itemTerpilihRiwayat.includes(t.id)) t.isBintang = !t.isBintang; });
    saveApotekDB('apotek_cashierHistory', cashierHistory);
    batalSeleksiRiwayat();
}

function prosesArsipMasalRiwayat() {
    if(itemTerpilihRiwayat.length === 0) return;
    let isKeArsip = riwayatTabAktifMobile !== 'arsip'; 
    cashierHistory.forEach(t => { if(itemTerpilihRiwayat.includes(t.id)) t.isArsip = isKeArsip; });
    saveApotekDB('apotek_cashierHistory', cashierHistory);
    batalSeleksiRiwayat();
    triggerHaptic([100, 50, 100]);
}

function renderRiwayatMobile() {
    const wadah = document.getElementById('daftarRiwayatMobile');
    let tglFilter = document.getElementById('filterTglRiwayatMobile').value;
    if(!tglFilter) { tglFilter = getTanggalLokal(); document.getElementById('filterTglRiwayatMobile').value = tglFilter; }
    
    let dataTampil = cashierHistory.filter(t => t.tanggal === tglFilter);
    if(riwayatTabAktifMobile === 'semua') dataTampil = dataTampil.filter(t => !t.isArsip);
    else if(riwayatTabAktifMobile === 'bintang') dataTampil = dataTampil.filter(t => t.isBintang && !t.isArsip);
    else if(riwayatTabAktifMobile === 'arsip') dataTampil = dataTampil.filter(t => t.isArsip);
    
    if (dataTampil.length === 0) {
        let pesanKosong = riwayatTabAktifMobile === 'arsip' ? 'Gudang Arsip Kosong.' : (riwayatTabAktifMobile === 'bintang' ? 'Belum ada struk ditandai bintang.' : 'Belum ada transaksi di tanggal ini.');
        wadah.innerHTML = `<div class="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm mt-4"><i class="fa-solid fa-file-invoice text-4xl text-slate-300 mb-3 block"></i><p class="font-bold text-slate-600">${pesanKosong}</p></div>`;
        return;
    }
    
    if(modeSeleksiRiwayatAktif) {
        document.getElementById('teksJumlahSeleksi').textContent = itemTerpilihRiwayat.length + " Dipilih";
        document.getElementById('btnArsipHeaderSeleksi').innerHTML = riwayatTabAktifMobile === 'arsip' ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
    }
    
    // [PENYEMPURNAAN 2] ILUSI VISUAL GROUPING BERDASAR WAKTU & NAMA
    let grupRiwayat = {};
    dataTampil.forEach(t => {
        let key = t.isPelunasan ? `PELUNASAN_${t.id}` : `${t.waktu}_${t.pelanggan || 'UMUM'}_${t.metode}`;
        if (!grupRiwayat[key]) {
            grupRiwayat[key] = {
                idGabungan: t.id, waktu: t.waktu, metode: t.metode, pelanggan: t.pelanggan, kasir: t.kasir,
                isPelunasan: t.isPelunasan, isBintang: t.isBintang, statusLunas: t.statusLunas,
                total: 0, item: 0, rincian: [], rawIds: []
            };
        }
        grupRiwayat[key].total += (t.total || 0);
        grupRiwayat[key].item += (t.item || 1);
        grupRiwayat[key].rawIds.push(t.id);
        
        if (t.isPelunasan) {
            grupRiwayat[key].obat = t.obat; 
        } else if(t.detailKeranjang && t.detailKeranjang.length > 0) {
            t.detailKeranjang.forEach(k => {
                // SUNTIKAN: Perakitan Nama Cerdas (Nama + Varian + Kategori)
                let nLengkap = k.nama;
                if(k.varian) nLengkap += ` ${k.varian}`;
                if(k.kategori) nLengkap += ` • ${k.kategori}`;
                
                // SUNTIKAN: Flexbox Smart Wrap (Harga anti-penyok & otomatis turun)
                grupRiwayat[key].rincian.push(`
                <div class="flex items-end w-full mb-1">
                    <div class="text-[10px] text-slate-600 font-semibold leading-tight shrink">- ${nLengkap} (x${k.qty})</div>
                    <div class="flex-grow border-b border-dotted border-slate-300 mx-1 mb-1 opacity-70 min-w-[10px]"></div>
                    <div class="text-[11px] font-black text-slate-800 shrink-0 leading-tight">${rupiah(k.jual * k.qty)}</div>
                </div>`);
            });
        } else {
            grupRiwayat[key].rincian.push(`
            <div class="flex items-end w-full mb-1">
                <div class="text-[10px] text-slate-600 font-semibold leading-tight shrink">- ${t.obat} (x${t.item || 1})</div>
                <div class="flex-grow border-b border-dotted border-slate-300 mx-1 mb-1 opacity-70 min-w-[10px]"></div>
                <div class="text-[11px] font-black text-slate-800 shrink-0 leading-tight">${rupiah(t.total)}</div>
            </div>`);
        }
    });

    wadah.innerHTML = Object.values(grupRiwayat).map(g => {
        let badgeWarna = g.metode === 'Tunai' ? 'bg-emerald-100 text-emerald-700' : (g.metode === 'QRIS' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700');
        let teksStatus = g.metode;
        
        if(g.metode === 'Debt' && g.statusLunas) teksStatus = 'Lunas / Ditutup';
        if(g.isPelunasan) teksStatus = 'Uang Masuk (Kasbon)';
        
        let isSelected = g.rawIds.some(id => itemTerpilihRiwayat.includes(id));
        let bgCard = isSelected ? 'bg-blue-50 border-blue-400 shadow-md transform scale-[0.98]' : 'bg-white border-slate-200 shadow-sm';
        let starIcon = g.isBintang ? `<i class="fa-solid fa-star text-amber-400 text-xs drop-shadow-sm ml-1.5 align-middle -mt-0.5"></i>` : '';
        
        // SUNTIKAN: Perubahan Judul menjadi "X Item Pembelian" agar minimalis
        let judulObat = g.isPelunasan ? g.obat : `<i class="fa-solid fa-box-open mr-1 text-slate-400"></i> ${g.item} Item Pembelian`;
        
        let teksKonsumen = (g.pelanggan && g.pelanggan !== 'UMUM' && !g.isPelunasan) ? `<p class="text-[10px] text-corporate-600 font-black mt-0.5 uppercase">Konsumen: ${g.pelanggan}</p>` : '';
        
        let areaRincian = '';
        if (!g.isPelunasan && g.rincian.length > 0) {
            areaRincian = `
            <div class="mt-3 mb-2 pt-2 border-t border-dashed border-slate-200">
                <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Rincian Faktur:</p>
                <div class="w-full">${g.rincian.join('')}</div>
            </div>`;
        }

        let tombolPortal = (g.metode === 'Debt' && g.pelanggan) ? `<button onclick="event.stopPropagation(); lompatKeBukuPiutang('${g.pelanggan}')" class="mt-2 text-[9px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1.5 w-max active:scale-95"><i class="fa-solid fa-book-open"></i> Lihat Buku Piutang</button>` : '';

        let tombolAksi = modeSeleksiRiwayatAktif ? '' : `
            <div class="flex gap-2 relative z-10 mt-3 justify-end border-t border-slate-100 pt-3">
                <button onclick="event.stopPropagation(); prosesBatalTransaksiMobile(${g.rawIds[0]})" class="text-[10px] text-red-500 hover:bg-red-50 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-red-100 shadow-sm active:scale-95"><i class="fa-solid fa-rotate-left"></i> Batal</button>
                <button onclick="event.stopPropagation(); prosesCetakStrukMobile(${g.rawIds[0]}, this)" class="text-[10px] text-blue-600 hover:bg-blue-50 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-blue-100 shadow-sm active:scale-95"><i class="fa-solid fa-print"></i> Cetak</button>
            </div>`;
            
        return `
        <div id="kartu-riwayat-${g.waktu.replace(':','')}-${g.pelanggan ? g.pelanggan.replace(/\s/g,'') : 'UMUM'}" onpointerdown="mulaiTekanRiwayat(${g.rawIds[0]})" onpointerup="lepasTekanRiwayat()" onpointerleave="lepasTekanRiwayat()" onclick="klikItemRiwayat(${g.rawIds[0]})" class="${bgCard} select-none border rounded-2xl p-4 flex flex-col transition-all cursor-pointer relative group">
            <div class="flex justify-between items-start pointer-events-none">
                <div class="pr-2 flex-1">
                    <!-- SUNTIKAN: Tampilan Tanggal + Jam agar aman saat difilter -->
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1"><i class="fa-regular fa-calendar-days"></i> ${tglFilter} (${g.waktu})</p>
                    <h3 class="font-bold text-slate-800 text-sm leading-tight inline-block mb-1">${judulObat} ${starIcon}</h3>
                    <p class="text-[10px] text-slate-500 font-medium">Oleh: ${g.kasir}</p>
                    ${teksKonsumen}
                </div>
                <div class="text-right shrink-0">
                    <p class="font-black ${isSelected ? 'text-blue-700' : 'text-corporate-700'} text-base">${rupiah(g.total)}</p>
                    <span class="inline-block mt-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${badgeWarna}">${teksStatus}</span>
                </div>
            </div>
            
            ${areaRincian}
            ${tombolPortal}
            ${tombolAksi}
        </div>`;
    }).join('');
}

// ==========================================
// 6. MESIN RENDER: PIUTANG & LAPORAN
// ==========================================
function renderPiutangMobile() {
    const wadah = document.getElementById('daftarPiutangMobile');
    const searchInput = document.getElementById('cariPiutangMobile');
    const filterTeks = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let totalPiutang = 0;
    
    // Ambil SEMUA transaksi Debt (Lunas & Belum) + Pelunasan untuk diracik jadi Rekening Koran
    const dataDebtMentah = cashierHistory.filter(t => t.metode === 'Debt' || t.isPelunasan);
    
    // Agregasi Pelanggan (Grup Utama)
    let agregasiPelanggan = {};
    
    dataDebtMentah.forEach(t => {
        if (!t.pelanggan) return;
        let namaNormal = t.pelanggan.trim().toUpperCase(); 
        
        if(!agregasiPelanggan[namaNormal]) {
            agregasiPelanggan[namaNormal] = { 
                nama: namaNormal, wa: t.wa, totalAktif: 0, 
                tunggakanAktif: {}, riwayatLunas: [], idsAktif: [] 
            };
        }

        if (t.isPelunasan) {
            // Masukkan ke Zona Hijau
            agregasiPelanggan[namaNormal].riwayatLunas.push(t);
        } else if (!t.statusLunas) {
            // Masukkan ke Zona Merah & Grupkan berdasarkan WAKTU (Ilusi Visual Waktu)
            agregasiPelanggan[namaNormal].totalAktif += (t.total || 0);
            agregasiPelanggan[namaNormal].idsAktif.push(t.id);
            totalPiutang += (t.total || 0);
            
            let keyWaktu = t.tanggal + '_' + t.waktu;
            if(!agregasiPelanggan[namaNormal].tunggakanAktif[keyWaktu]) {
                agregasiPelanggan[namaNormal].tunggakanAktif[keyWaktu] = {
                    tanggal: t.tanggal, waktu: t.waktu, totalWaktuIni: 0, items: []
                };
            }
            agregasiPelanggan[namaNormal].tunggakanAktif[keyWaktu].totalWaktuIni += t.total;
            agregasiPelanggan[namaNormal].tunggakanAktif[keyWaktu].items.push(t);
        }
    });

    document.getElementById('headerTotalPiutangMobile').textContent = rupiah(totalPiutang);

    // Filter Pencarian & Buang pelanggan yang tidak punya hutang aktif sama sekali
    // [PENYEMPURNAAN UX] Memastikan jika kolom cari kosong, SELURUH PENGUTANG tampil tanpa kecuali
    let listTampil = Object.values(agregasiPelanggan)
        .filter(p => p.totalAktif > 0 && (filterTeks === '' || p.nama.toLowerCase().includes(filterTeks)));

    if(listTampil.length === 0) {
        if (filterTeks === '') {
            wadah.innerHTML = `<div class="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm mt-4"><i class="fa-solid fa-face-smile-beam text-5xl text-emerald-400 mb-3 block"></i><p class="font-bold text-slate-600">Bagus Sekali!</p><p class="text-xs text-slate-500 mt-1">Tidak ada pelanggan yang menunggak.</p></div>`;
        } else {
            wadah.innerHTML = `<div class="text-center p-6 text-slate-400 text-xs font-bold">Pencarian tidak ditemukan.</div>`;
        }
        return;
    }

    wadah.innerHTML = listTampil.map(p => {
        
        // Logika Pintar: Cek apakah total utang pelanggan ini > 1
        let isMultiUtang = p.idsAktif.length > 1; 

        // ==========================================
        // RENDER ZONA MERAH (Tunggakan Dikelompokkan by Waktu)
        // ==========================================
        let zonaMerahHtml = Object.values(p.tunggakanAktif).map(grup => {
            
            // Logika Pintar: Cek apakah di dalam kotak waktu ini ada > 1 barang
            let isMultiDalamSatuWaktu = grup.items.length > 1; 
            
            // Baris Obat & Tombol Centang Kecil (Eceran)
            let itemLines = grup.items.map(itemDb => {
                let qtyTampil = 1;
                let namaLengkap = itemDb.obat;
                
                // SUNTIKAN: Ekstraksi Nama Cerdas (Nama + Varian + Kategori)
                if (itemDb.detailKeranjang && itemDb.detailKeranjang.length > 0) {
                    let k = itemDb.detailKeranjang[0];
                    qtyTampil = k.qty;
                    namaLengkap = k.nama;
                    if(k.varian) namaLengkap += ` ${k.varian}`;
                    if(k.kategori) namaLengkap += ` • ${k.kategori}`;
                } else {
                    qtyTampil = itemDb.item || 1;
                }
                
                // Param fungsi pelunasan di-escape agar tidak merusak tombol jika namanya ada tanda kutip
                let namaObatParam = namaLengkap.replace(/'/g, "\\'");
                
                // Centang Kotak (Checkbox) HANYA muncul jika utang total lebih dari 1
                let checkboxHtml = isMultiUtang ? `
                <button onclick="prosesPelunasanEceran('${itemDb.id}', '${p.nama}', ${itemDb.total}, '${namaObatParam}')" class="w-5 h-5 mt-0.5 rounded-md text-[10px] flex items-center justify-center border border-slate-300 bg-white text-slate-300 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all shadow-sm shrink-0" title="Lunasi Item Ini Saja">
                    <i class="fa-solid fa-check"></i>
                </button>` : '';

                // SUNTIKAN: Flexbox Smart Wrap (Sejajar sempurna dengan harga di kanan)
                return `
                <div class="flex items-end w-full mb-1.5 group/item hover:bg-slate-100 p-1.5 -mx-1.5 rounded-lg transition-colors">
                    <div class="flex items-start gap-2 shrink">
                        ${checkboxHtml}
                        <div class="text-[10.5px] text-slate-700 font-semibold leading-tight pt-0.5">${namaLengkap} (x${qtyTampil})</div>
                    </div>
                    <div class="flex-grow border-b border-dotted border-slate-300 mx-1 mb-1.5 opacity-70 min-w-[10px]"></div>
                    <div class="text-[11px] font-black text-slate-800 shrink-0 leading-tight pb-0.5">${rupiah(itemDb.total)}</div>
                </div>`;
            }).join('');

            // Teks Harga di Sudut Kanan Atas Waktu (Dihilangkan jika hanya 1 item dalam waktu tersebut)
            let totalWaktuHtml = isMultiDalamSatuWaktu ? `<span class="font-black text-red-600 text-xs bg-red-50 px-2 py-1 rounded-md border border-red-100 shadow-inner">${rupiah(grup.totalWaktuIni)}</span>` : '';

            // Perubahan Desain: Outline Card Penuh (Bukan sekadar garis kiri)
            return `
            <div class="bg-white border border-red-200 rounded-xl p-3.5 mb-3 shadow-sm relative overflow-hidden">
                <div class="absolute left-0 top-0 bottom-0 w-1 bg-red-400"></div>
                <div class="flex justify-between items-center border-b border-slate-100 pb-2.5 mb-2.5 pl-1.5">
                    <span class="text-[10px] font-bold text-slate-500 flex items-center gap-1.5"><i class="fa-regular fa-calendar-days text-slate-400"></i> ${grup.tanggal} (${grup.waktu})</span>
                    ${totalWaktuHtml}
                </div>
                <div class="pl-1.5 mb-3">
                    ${itemLines}
                </div>
                <div class="pl-1.5">
                    <button onclick="lompatKeRiwayat('${grup.tanggal}', '${grup.waktu}', '${p.nama}')" class="text-[9px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1.5 w-max active:scale-95 shadow-sm">
                        <i class="fa-solid fa-clock-rotate-left"></i> Cek Jejak Asli
                    </button>
                </div>
            </div>`;
        }).join('');

        // ==========================================
        // RENDER ZONA HIJAU (Rekening Koran Pelunasan)
        // ==========================================
        let zonaHijauHtml = '';
        if (p.riwayatLunas.length > 0) {
            // Urutkan dari yang paling baru
            p.riwayatLunas.sort((a, b) => b.id - a.id);
            let limitTampil = p.riwayatLunas.slice(0, 3); // Tampilkan max 3 terakhir agar tidak kepanjangan
            
            let lunasLines = limitTampil.map(lunasDb => `
            <div class="bg-white border border-emerald-200 rounded-xl p-3 mb-2 shadow-sm relative overflow-hidden">
                <div class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400"></div>
                <div class="flex justify-between items-center mb-1.5 pl-1.5">
                    <span class="text-[10px] font-bold text-emerald-600 flex items-center gap-1.5"><i class="fa-solid fa-check-circle"></i> ${lunasDb.tanggal} (${lunasDb.waktu})</span>
                    <span class="font-black text-emerald-700 text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">+ ${rupiah(lunasDb.total)}</span>
                </div>
                <p class="text-[10px] text-slate-500 leading-tight truncate pl-1.5 font-medium">Membayar: <span class="text-slate-700">${lunasDb.obat.replace('PELUNASAN GABUNGAN: ','').replace('Pelunasan Utang: ','').replace('Pelunasan Eceran: ','')}</span></p>
            </div>`).join('');
            
            zonaHijauHtml = `
            <div class="mt-5 pt-4 border-t border-slate-200">
                <div class="flex items-center gap-2 mb-3">
                    <div class="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><i class="fa-solid fa-clock-rotate-left text-[10px]"></i></div>
                    <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Riwayat Pelunasan Terakhir</p>
                </div>
                ${lunasLines}
            </div>`;
        }

        // Teks Tombol Bawah (Dinamic based on item count)
        let teksTombolLunas = isMultiUtang ? 'LUNASI SEMUA' : 'LUNASI';

        // ==========================================
        // KARTU UTAMA MUKRIN
        // ==========================================
        return `
        <div id="kartu-piutang-${p.nama.replace(/\s/g,'')}" class="bg-slate-50 border-2 border-slate-200 rounded-[1.5rem] p-5 shadow-md relative transition-all duration-500 overflow-hidden">
            <div class="absolute top-0 right-0 w-24 h-24 bg-white rounded-bl-full -z-0 opacity-60 pointer-events-none"></div>
            
            <div class="flex justify-between items-start mb-4 relative z-10">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xl shadow-inner border border-slate-300"><i class="fa-solid fa-user"></i></div>
                    <div>
                        <h4 class="font-black text-slate-800 text-lg uppercase tracking-tight leading-none mb-1">${p.nama}</h4>
                        <p class="text-[10px] font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-md inline-block">${p.idsAktif.length} Item Menggantung</p>
                    </div>
                </div>
                <div class="flex gap-2 shrink-0">
                    <button onclick="tagihWAMultiPiutang('${p.nama}')" class="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-200 shadow-sm active:scale-95 transition-transform" title="Kirim Tagihan WA">
                        <i class="fa-brands fa-whatsapp text-xl"></i>
                    </button>
                    <button onclick="bukaKasirKhususPiutang('${p.nama}', '${p.wa || ''}')" class="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-200 shadow-sm active:scale-95 transition-transform" title="Tambah Utang Baru">
                        <i class="fa-solid fa-cart-plus text-lg"></i>
                    </button>
                </div>
            </div>

            <div class="mb-2 relative z-10">
                <div class="flex items-center gap-2 mb-3">
                    <div class="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600"><i class="fa-solid fa-triangle-exclamation text-[10px] animate-pulse"></i></div>
                    <p class="text-[10px] font-black text-red-600 uppercase tracking-widest">Tunggakan Aktif</p>
                </div>
                <div class="max-h-[300px] overflow-y-auto hide-scrollbar pb-1">
                    ${zonaMerahHtml}
                </div>
            </div>
            
            <div class="relative z-10">
                ${zonaHijauHtml}
            </div>

            <div class="bg-white border border-slate-200 rounded-xl p-4 mt-4 relative z-10 shadow-sm">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-black text-slate-500 uppercase tracking-wider">Total Tunggakan</span>
                    <span class="text-2xl font-black text-red-600 tracking-tight drop-shadow-sm">${rupiah(p.totalAktif)}</span>
                </div>

                <button onclick="bukaModalPelunasanMobile('${p.idsAktif.join(',')}', '${p.nama}', ${p.totalAktif})" class="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black py-4 rounded-xl shadow-[0_4px_15px_rgba(239,68,68,0.3)] transition-transform active:scale-95 flex items-center justify-center gap-2 text-[13px] uppercase tracking-wider border border-red-400">
                    <i class="fa-solid fa-hand-holding-dollar text-lg"></i> ${teksTombolLunas}
                </button>
            </div>
        </div>`;
    }).join('');
}

// FUNGSI SHORTCUT PIUTANG -> KASIR
function bukaKasirKhususPiutang(nama, wa) {
    bukaLayar('beranda'); 
    setTimeout(() => {
        bukaModalKasirMobile();
        document.querySelector('input[value="Debt"]').checked = true;
        toggleFormKasbonMobile();
        document.getElementById('kasbonNamaMobile').value = nama;
        if(wa && wa !== 'undefined') document.getElementById('kasbonWaMobile').value = wa;
        showToast(`🛒 Shortcut: Mode Kasbon untuk ${nama} telah diaktifkan.`);
    }, 100);
}

// FUNGSI MESIN WAKTU -> RIWAYAT TANGGAL ASLI
function lompatKeRiwayat(tanggal) {
    document.getElementById('filterTglRiwayatMobile').value = tanggal;
    ubahTabRiwayat('semua');
    bukaLayar('riwayat');
    setTimeout(() => showToast(`⏰ Melompat ke arsip tanggal ${tanggal}`), 300);
}
// [PENYEMPURNAAN 3 & 4] PORTAL NAVIGASI DUA ARAH & ANIMASI BERKEDIP
function lompatKeRiwayat(tanggal, waktuJam, nama) {
    document.getElementById('filterTglRiwayatMobile').value = tanggal;
    ubahTabRiwayat('semua');
    bukaLayar('riwayat');
    
    // Mesin Animasi Pencari Kotak Waktu
    setTimeout(() => {
        let idTarget = `kartu-riwayat-${waktuJam.replace(':','')}-${nama.replace(/\s/g,'')}`;
        let kotakTujuan = document.getElementById(idTarget);
        if(kotakTujuan) {
            kotakTujuan.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Efek Sihir Nyala Kuning
            kotakTujuan.classList.add('bg-amber-100', 'border-amber-400', 'shadow-[0_0_20px_rgba(251,191,36,0.5)]');
            kotakTujuan.classList.remove('bg-white', 'border-slate-200');
            setTimeout(() => {
                kotakTujuan.classList.remove('bg-amber-100', 'border-amber-400', 'shadow-[0_0_20px_rgba(251,191,36,0.5)]');
                kotakTujuan.classList.add('bg-white', 'border-slate-200');
            }, 2500); // Padam setelah 2.5 detik
        }
        showToast(`⏰ Tiba di riwayat ${waktuJam}`);
    }, 400);
}

function lompatKeBukuPiutang(namaPelanggan) {
    bukaLayar('piutang');
    let searchInput = document.getElementById('cariPiutangMobile');
    if(searchInput) {
        searchInput.value = namaPelanggan;
        renderPiutangMobile(); // Force render filter
        
        // Animasi Pencari Kartu Piutang
        setTimeout(() => {
            let idTarget = `kartu-piutang-${namaPelanggan.replace(/\s/g,'')}`;
            let kotakTujuan = document.getElementById(idTarget);
            if(kotakTujuan) {
                kotakTujuan.scrollIntoView({ behavior: 'smooth', block: 'start' });
                kotakTujuan.classList.add('shadow-[0_0_25px_rgba(59,130,246,0.4)]', 'border-blue-400');
                setTimeout(() => {
                    kotakTujuan.classList.remove('shadow-[0_0_25px_rgba(59,130,246,0.4)]', 'border-blue-400');
                }, 2500);
            }
        }, 400);
    }
}

// [PENYEMPURNAAN 5] EKSEKUSI PELUNASAN ECERAN (PER ITEM)
function prosesPelunasanEceran(idTransaksiDb, namaPelanggan, totalItem, namaObat) {
    tampilkanConfirmMobile(`Terima uang pelunasan untuk:\n\n${namaObat}\nSenilai: ${rupiah(totalItem)}?\n\nUtang ini akan dipindah ke Riwayat Lunas.`, function() {
        
        // Kita bypass metode dengan 'Tunai' otomatis untuk eceran, 
        // atau jika mau dinamis bisa lempar ke Modal. 
        // Tapi demi kecepatan UX kasir di depan layar, langsung proses sbg Tunai (Laci).
        const trxTarget = cashierHistory.find(t => t.id.toString() === idTransaksiDb.toString());
        
        if (trxTarget && !trxTarget.statusLunas) {
            trxTarget.statusLunas = true;
            
            const idPelunasanBaru = Date.now();
            const tglWaktu = new Date();
            trxTarget.idTerkait = idPelunasanBaru;

            const pelunasanBaru = {
                id: idPelunasanBaru, tanggal: getTanggalLokal(), waktu: tglWaktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                obat: `Pelunasan Eceran: ${namaObat}`, kasir: 'Pemilik', item: 1, total: totalItem, metode: 'Tunai', laba: 0, pelanggan: namaPelanggan, wa: trxTarget.wa, isPelunasan: true, idTerkait: idTransaksiDb
            };
            
            siklusAktif.uangMasuk += totalItem;
            cashierHistory.unshift(pelunasanBaru);
            
            kirimNotifikasiMobile('Lunas Eceran', `Menerima tunai ${rupiah(totalItem)} dari ${namaPelanggan}.`, 'lunas', totalItem);

            saveApotekDB('apotek_cashierHistory', cashierHistory); 
            saveApotekDB('apotek_siklusAktif', siklusAktif);

            renderPiutangMobile(); renderBerandaMobile(); renderRiwayatMobile();
            triggerHaptic([50, 100]);
            showToast(`✅ ${namaObat} Lunas!`);
        }
    });
}

function renderLaporanMobile() {
    const wadah = document.getElementById('kontenLaporanMobile');
    let tglFilter = document.getElementById('filterTglLaporanMobile').value;
    if(!tglFilter) { tglFilter = getTanggalLokal(); document.getElementById('filterTglLaporanMobile').value = tglFilter; }
    
    let dataPeriode = cashierHistory.filter(t => t.tanggal === tglFilter);
    
    let lOmset = 0, lLaba = 0, lHPP = 0, lTunai = 0, lQris = 0, lDebt = 0, lPelunasan = 0, cPembeli = 0, cItem = 0;
    
    dataPeriode.forEach(t => {
        if(t.metode === 'Tunai') { if(t.isPelunasan) lPelunasan += t.total; else lTunai += t.total; } 
        else if(t.metode === 'QRIS') { if(t.isPelunasan) lPelunasan += t.total; else lQris += t.total; } 
        else if(t.metode === 'Debt') { if(!t.statusLunas) lDebt += t.total; }
        
        if(!t.isPelunasan) { 
            lOmset += t.total; lLaba += t.laba; lHPP += (t.total - t.laba);
            cPembeli += 1; cItem += t.item; 
        }
    });
    
    wadah.innerHTML = `
        <div class="bg-gradient-to-br from-corporate-800 to-corporate-900 rounded-3xl p-5 shadow-lg text-white relative overflow-hidden">
            <div class="absolute -right-10 -bottom-10 opacity-10"><i class="fa-solid fa-chart-line text-9xl"></i></div>
            <p class="text-[10px] font-bold text-corporate-200 uppercase tracking-widest mb-1">Performa Bisnis</p>
            <div class="space-y-3 relative z-10">
                <div class="flex justify-between items-end border-b border-corporate-700 pb-2"><span class="text-sm font-semibold text-corporate-100">Total Omzet</span><span class="text-xl font-black">${rupiah(lOmset)}</span></div>
                <div class="flex justify-between items-end border-b border-corporate-700 pb-2"><span class="text-sm font-semibold text-corporate-100">Modal Terjual (HPP)</span><span class="text-base font-bold text-red-300">-${rupiah(lHPP)}</span></div>
                <div class="flex justify-between items-end pt-1"><span class="text-sm font-black text-emerald-400 uppercase">Laba Bersih</span><span class="text-2xl font-black text-emerald-400 drop-shadow-md">${rupiah(lLaba)}</span></div>
            </div>
        </div>
        
        <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Arus Kas & Piutang</p>
            <div class="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><i class="fa-solid fa-money-bill text-sm"></i></div><div><p class="text-xs font-bold text-slate-700">Tunai Masuk</p><p class="text-[9px] text-slate-400 font-medium">Laci Kasir Fisik</p></div></div><span class="font-black text-emerald-600 text-sm">${rupiah(lTunai)}</span></div>
            <div class="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><i class="fa-solid fa-qrcode text-sm"></i></div><div><p class="text-xs font-bold text-slate-700">QRIS / Transfer</p><p class="text-[9px] text-slate-400 font-medium">Saldo Rekening</p></div></div><span class="font-black text-blue-600 text-sm">${rupiah(lQris)}</span></div>
            <div class="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center"><i class="fa-solid fa-book-open text-sm"></i></div><div><p class="text-xs font-bold text-slate-700">Kasbon Baru</p><p class="text-[9px] text-slate-400 font-medium">Uang Tertahan</p></div></div><span class="font-black text-red-600 text-sm">${rupiah(lDebt)}</span></div>
            <div class="flex justify-between items-center bg-amber-50 p-3 rounded-2xl border border-amber-200 border-dashed"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center"><i class="fa-solid fa-hand-holding-dollar text-sm"></i></div><div><p class="text-xs font-bold text-amber-800">Pelunasan Utang</p><p class="text-[9px] text-amber-600 font-medium">Masuk Kas Hari Ini</p></div></div><span class="font-black text-amber-600 text-sm">+ ${rupiah(lPelunasan)}</span></div>
        </div>
        
        <div class="grid grid-cols-2 gap-3 pb-4">
            <div class="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm"><i class="fa-solid fa-users text-corporate-500 text-xl mb-2 block"></i><span class="block text-2xl font-black text-slate-800">${cPembeli}</span><span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pembeli</span></div>
            <div class="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm"><i class="fa-solid fa-box-open text-amber-500 text-xl mb-2 block"></i><span class="block text-2xl font-black text-slate-800">${cItem}</span><span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Obat Terjual</span></div>
        </div>
    `;
}

// ==========================================
// 6.5. MESIN REKAPITULASI (TUNAI & DIGITAL)
// ==========================================
let metodeRekapAktif = 'Tunai';

function bukaLayarRekapMobile(metode) {
    metodeRekapAktif = metode;
    bukaLayar('rekap');
}

function renderRekapMobile() {
    const wadah = document.getElementById('daftarRekapMobile');
    let tglHariIni = getTanggalLokal();
    
    // Setting Header Sesuai Metode
    document.getElementById('judulLayarRekap').textContent = metodeRekapAktif === 'Tunai' ? 'REKAP TUNAI' : 'REKAP DIGITAL';
    document.getElementById('tanggalLayarRekap').textContent = 'Hari Ini: ' + tglHariIni;

    // Filter Transaksi (Hanya hari ini, sesuai metode, bukan pelunasan utang)
    let dataPeriode = cashierHistory.filter(t => t.tanggal === tglHariIni && t.metode === metodeRekapAktif && !t.isPelunasan);
    
    let rekapItem = {};
    let grandTotalBiji = 0;
    let grandTotalModal = 0;
    let grandTotalJual = 0;

    // Mesin Penggiling & Pengelompokan Data
    dataPeriode.forEach(trx => {
        if (trx.detailKeranjang && trx.detailKeranjang.length > 0) {
            trx.detailKeranjang.forEach(item => {
                let namaFinal = item.nama;
                
                if(!rekapItem[namaFinal]) {
                    rekapItem[namaFinal] = { nama: namaFinal, qty: 0, modal: 0, jual: 0 };
                }
                
                let hpp = item.hppSatuan || Math.round(item.jual * 0.8); 
                let subModal = hpp * item.qty;
                let subJual = item.jual * item.qty;
                
                rekapItem[namaFinal].qty += item.qty;
                rekapItem[namaFinal].modal += subModal;
                rekapItem[namaFinal].jual += subJual;
                
                grandTotalBiji += item.qty;
                grandTotalModal += subModal;
                grandTotalJual += subJual;
            });
        } else {
            // Skema Fallback untuk data lama sebelum ada sistem keranjang
            let qty = trx.item || 1;
            let hpp = ((trx.total || 0) - (trx.laba || 0));
            let jual = trx.total || 0;
            
            if(!rekapItem[trx.obat]) {
                rekapItem[trx.obat] = { nama: trx.obat, qty: 0, modal: 0, jual: 0 };
            }
            
            rekapItem[trx.obat].qty += qty;
            rekapItem[trx.obat].modal += hpp;
            rekapItem[trx.obat].jual += jual;
            
            grandTotalBiji += qty;
            grandTotalModal += hpp;
            grandTotalJual += jual;
        }
    });

    if (Object.keys(rekapItem).length === 0) {
        wadah.innerHTML = `<div class="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm mt-4"><i class="fa-solid fa-box-open text-4xl text-slate-300 mb-3 block"></i><p class="font-bold text-slate-600">Belum ada item terjual via ${metodeRekapAktif} hari ini.</p></div>`;
    } else {
        let urut = 1;
        wadah.innerHTML = Object.values(rekapItem).map(r => {
            return `
            <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-start gap-3 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-16 h-16 bg-slate-50 rounded-bl-full -z-0 opacity-50"></div>
                <div class="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs shrink-0 border border-slate-200 relative z-10">${urut++}</div>
                <div class="flex-1 relative z-10">
                    <h4 class="font-black text-slate-800 text-sm leading-tight mb-2">${r.nama}</h4>
                    <p class="text-[11px] font-bold text-slate-600 leading-relaxed">
                        <span class="bg-slate-100 px-2 py-0.5 rounded text-slate-700">${r.qty} Biji</span> <span class="text-slate-300 mx-0.5">|</span> 
                        Modal: <span class="text-red-500">${rupiah(r.modal)}</span> <span class="text-slate-300 mx-0.5">|</span> 
                        Jual: <span class="text-emerald-600">${rupiah(r.jual)}</span>
                    </p>
                </div>
            </div>`;
        }).join('');
    }

    // Suntik Angka Kesimpulan ke Bottom Summary
    document.getElementById('rekapTotalBiji').textContent = grandTotalBiji + " Biji";
    document.getElementById('rekapTotalModal').textContent = rupiah(grandTotalModal);
    document.getElementById('rekapTotalJual').textContent = rupiah(grandTotalJual);
}

// ==========================================
// 7. MESIN MODAL UMUM
// ==========================================
let idBatchAktif = null;

function bukaModalMobile(idModal, idPanel) {
    const modal = document.getElementById(idModal); const panel = document.getElementById(idPanel);
    modal.classList.remove('hidden'); setTimeout(() => { panel.classList.remove('translate-y-full'); }, 10);
}
function tutupModalMobile(idModal) {
    const modal = document.getElementById(idModal); const panel = modal.querySelector('.transform.transition-transform');
    if(panel) panel.classList.add('translate-y-full'); setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

// ==========================================
// 8. MESIN TRANSFER GUDANG KE ETALASE
// ==========================================
let dnaIndukTransferAktif = null;

function bukaModalTransferMobile(dnaInduk) {
    dnaIndukTransferAktif = dnaInduk;
    let batches = masterItems.filter(i => i.dnaInduk === dnaInduk);
    
    if(batches.length > 0) { 
         let namaObat = batches[0].nama;
        let totalStok = batches.reduce((sum, b) => sum + b.stok, 0);
        
        document.getElementById('transferNamaObat').textContent = namaObat; 
         document.getElementById('transferSisaGudang').textContent = totalStok; 
         document.getElementById('transferInputQty').value = ''; 
         bukaModalMobile('modalTransferMobile', 'panelTransferMobile'); 
         setTimeout(() => document.getElementById('transferInputQty').focus(), 350); 
     }
}

function prosesTransferMobile() {
    let inputQty = parseInt(document.getElementById('transferInputQty').value);
    if(isNaN(inputQty) || inputQty <= 0) return alert("Masukkan jumlah yang benar!");
    
    let batchesGudang = masterItems.filter(i => i.dnaInduk === dnaIndukTransferAktif && i.stok > 0);
    let totalStokGudang = batchesGudang.reduce((sum, b) => sum + b.stok, 0);
    if(inputQty > totalStokGudang) return alert("Gagal! Sisa total di gudang tidak cukup.");
    
    // Mesin Cerdas FIFO (Urutkan dari yang paling cepat expired)
    batchesGudang.sort((a, b) => new Date(a.expired || '2099-12-31') - new Date(b.expired || '2099-12-31'));
    
    let sisaYgHarusDipindah = inputQty;
    let namaObat = batchesGudang[0].nama;
    let kategoriObat = batchesGudang[0].kategori;
    let jualObat = batchesGudang[0].jual;
    let varianObat = batchesGudang[0].varian; // Tambahkan ini
    
    let barangEtalase = etalaseItems.find(e => e.dnaInduk === dnaIndukTransferAktif || e.nama === namaObat);
    if(!barangEtalase) { 
         barangEtalase = { dnaInduk: dnaIndukTransferAktif, nama: namaObat, kategori: kategoriObat, jual: jualObat, varian: varianObat, stok: 0, antreanFIFO: [] }; // Tambahkan varian: varianObat
         etalaseItems.push(barangEtalase); 
     }
    
    // Proses Penyedotan per Batch
    for (let i = 0; i < batchesGudang.length; i++) {
        let batch = batchesGudang[i];
        if (sisaYgHarusDipindah <= 0) break;
        
          let jumlahDiambil = Math.min(batch.stok, sisaYgHarusDipindah);
                    
                    // --- MESIN PECAHAN DINAMIS (MASAL GUDANG -> ETALASE) ---
                    let modalSisa = batch.totalModal !== undefined ? batch.totalModal : (batch.modal * batch.stok);
                    let nilaiModalDipindah = Math.round((jumlahDiambil / batch.stok) * modalSisa);
                    
                    if (batch.totalModal !== undefined) batch.totalModal -= nilaiModalDipindah;
                    batch.stok -= jumlahDiambil;
                    sisaYgHarusDipindah -= jumlahDiambil;
                    
                    barangEtalase.stok += jumlahDiambil;
                    
                    if(!barangEtalase.antreanFIFO) barangEtalase.antreanFIFO = [];
                    let batchSamaDiEtalase = barangEtalase.antreanFIFO.find(b => b.idBatch === batch.idBatch);
                    
                    if(batchSamaDiEtalase) { 
                         batchSamaDiEtalase.stok += jumlahDiambil; 
                         if (batchSamaDiEtalase.totalModal !== undefined) batchSamaDiEtalase.totalModal += nilaiModalDipindah;
                     } else { 
                         barangEtalase.antreanFIFO.push({ idBatch: batch.idBatch, modal: batch.modal, stok: jumlahDiambil, expired: batch.expired, totalModal: nilaiModalDipindah }); 
                     }

    }
    
    barangEtalase.antreanFIFO.sort((a, b) => new Date(a.expired || '2099-12-31') - new Date(b.expired || '2099-12-31'));
    
    saveApotekDB('apotek_masterItems', masterItems); 
    saveApotekDB('apotek_etalaseItems', etalaseItems);
    
    tutupModalMobile('modalTransferMobile'); 
    renderGudangMobile(document.getElementById('cariGudangMobile').value); 
    renderBerandaMobile(); 
    triggerHaptic([100, 50, 100]);
    alert("📦 " + inputQty + " " + namaObat + " berhasil dipindah ke Etalase!");
}

// ==========================================
// 9. MESIN EDIT MULTI-BATCH & KUNCI
// ==========================================
let currentEditBatchesMobile = [];
let activeEditBatchIndexMobile = 0;
let isAddingNewBatchMobile = false;

function bukaModalEditMobile(idBatch) {
    idBatchAktif = idBatch; 
    let barang = masterItems.find(i => i.idBatch === idBatch);
    
    if(barang) {
        currentEditBatchesMobile = masterItems.filter(m => m.dnaInduk === barang.dnaInduk);
        currentEditBatchesMobile.sort((a, b) => a.idBatch.localeCompare(b.idBatch));
        activeEditBatchIndexMobile = currentEditBatchesMobile.findIndex(b => b.idBatch === idBatch);
        if(activeEditBatchIndexMobile === -1) activeEditBatchIndexMobile = 0;
        isAddingNewBatchMobile = false;
        
        renderEditTabsMobile();
        loadFormEditBatchMobile();
        kunciFormEditMobile();
        bukaModalMobile('modalEditMobile', 'panelEditMobile');
    }
}

function renderEditTabsMobile() {
    let html = currentEditBatchesMobile.map((b, index) => {
        let isActive = (!isAddingNewBatchMobile && index === activeEditBatchIndexMobile) ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200';
        return `<button type="button" onclick="pindahTabEditMobile(${index})" class="whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition ${isActive}">Batch ${index + 1}</button>`;
    }).join('');
    
    let addActive = isAddingNewBatchMobile ? 'bg-blue-600 text-white shadow-md' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200';
    html += `<button type="button" onclick="siapkanBatchBaruMobile()" class="whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 ${addActive}"><i class="fa-solid fa-plus"></i> Batch Baru</button>`;
    
    document.getElementById('editBatchNavMobile').innerHTML = html;
}

function pindahTabEditMobile(index) {
    isAddingNewBatchMobile = false; activeEditBatchIndexMobile = index;
    idBatchAktif = currentEditBatchesMobile[index].idBatch;
    renderEditTabsMobile(); loadFormEditBatchMobile(); kunciFormEditMobile();
}

function siapkanBatchBaruMobile() {
    isAddingNewBatchMobile = true; renderEditTabsMobile();
    let referensi = currentEditBatchesMobile[0];
    
    document.getElementById('editNamaMobile').value = referensi.nama; 
    document.getElementById('editVarianMobile').value = referensi.varian || '';
    document.getElementById('editKategoriMobile').value = referensi.kategori;
    document.getElementById('editModalMobile').value = '';
    document.getElementById('editJualMobile').value = referensi.jual; 
    document.getElementById('editStokMobile').value = '';
    document.getElementById('editExpiredMobile').value = '';
    
    aktifkanModeEditMobile(); 
    document.getElementById('editNamaMobile').readOnly = true; document.getElementById('editNamaMobile').classList.add('bg-slate-200','text-slate-500');
    document.getElementById('editVarianMobile').readOnly = true; document.getElementById('editVarianMobile').classList.add('bg-slate-200','text-slate-500');
    document.getElementById('editKategoriMobile').readOnly = true; document.getElementById('editKategoriMobile').classList.add('bg-slate-200','text-slate-500');
    document.getElementById('editJualMobile').readOnly = true; document.getElementById('editJualMobile').classList.add('bg-slate-200','text-slate-500');
    document.getElementById('btnUbahJualMobile').classList.add('hidden');
     
    let btnAksi = document.getElementById('btnAksiEditMobile');
    btnAksi.innerHTML = '<i class="fa-solid fa-plus-circle text-lg"></i> Simpan Batch Baru';
    btnAksi.className = 'w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/30 transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm uppercase tracking-wider';
}

function loadFormEditBatchMobile() {
    let barang = currentEditBatchesMobile[activeEditBatchIndexMobile];
    document.getElementById('editNamaMobile').value = barang.nama; 
    document.getElementById('editVarianMobile').value = barang.varian || ''; 
    document.getElementById('editKategoriMobile').value = barang.kategori;
    document.getElementById('editModalMobile').value = barang.modal;
    document.getElementById('editJualMobile').value = barang.jual; 
    document.getElementById('editStokMobile').value = barang.stok;
    document.getElementById('editExpiredMobile').value = barang.expired || '';
}

function kunciFormEditMobile() {
    let formInputs = document.querySelectorAll('#panelEditMobile input');
    formInputs.forEach(input => {
        input.readOnly = true; 
        input.classList.add('bg-slate-100', 'text-slate-500'); 
        input.classList.remove('bg-white', 'text-slate-800');
    });
    
    document.getElementById('teksHeaderKunciEdit').innerHTML = '<i class="fa-solid fa-pen text-blue-300"></i> Edit Data Obat';
    document.getElementById('subTeksHeaderKunci').innerHTML = 'Mode Terkunci ├░┼╕тАЭтАЩ (Ketuk untuk Edit)';
    document.getElementById('btnHeaderKunciEdit').classList.replace('from-amber-500', 'from-blue-600');
    document.getElementById('btnHeaderKunciEdit').classList.replace('to-orange-600', 'to-indigo-700');
    document.getElementById('btnUbahJualMobile').classList.add('hidden');
    let btnAksi = document.getElementById('btnAksiEditMobile');
    btnAksi.innerHTML = 'Tutup Layar';
    btnAksi.className = 'w-full bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-transform active:scale-95 text-sm uppercase tracking-wider';
}

function aktifkanModeEditMobile() {
    let formInputs = document.querySelectorAll('#panelEditMobile input');
    formInputs.forEach(input => {
        input.readOnly = false; 
        input.classList.remove('bg-slate-100', 'text-slate-500'); 
        input.classList.add('bg-white', 'text-slate-800');
    });
    
    let inputJual = document.getElementById('editJualMobile');
    inputJual.readOnly = true; inputJual.classList.add('bg-slate-200', 'text-slate-500');
    document.getElementById('btnUbahJualMobile').classList.remove('hidden');
    
    document.getElementById('teksHeaderKunciEdit').innerHTML = '<i class="fa-solid fa-lock-open text-amber-200"></i> Edit Terbuka';
    document.getElementById('subTeksHeaderKunci').innerHTML = 'Mode Edit Aktif ├в┼У┬П├п┬╕┬П';
    document.getElementById('btnHeaderKunciEdit').classList.replace('from-blue-600', 'from-amber-500');
    document.getElementById('btnHeaderKunciEdit').classList.replace('to-indigo-700', 'to-orange-600');
    let btnAksi = document.getElementById('btnAksiEditMobile');
    btnAksi.innerHTML = '<i class="fa-solid fa-save text-lg"></i> Simpan Perubahan';
    btnAksi.className = 'w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-600/30 transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm uppercase tracking-wider';
}

function bukaKunciHargaJualMobile() {
    let inputJual = document.getElementById('editJualMobile');
    inputJual.readOnly = false;
    inputJual.classList.remove('bg-slate-200', 'text-slate-500');
    inputJual.classList.add('bg-white', 'text-slate-900');
    inputJual.focus();
    document.getElementById('btnUbahJualMobile').classList.add('hidden');
}

function prosesTombolAksiEditMobile() {
    let btnAksi = document.getElementById('btnAksiEditMobile');
    if (btnAksi.innerHTML.includes('Tutup Layar')) { tutupModalMobile('modalEditMobile'); } 
    else { simpanEditLanjutanMobile(); }
}

function eksekusiSimpanEditLanjutanMobile(isKulakanBaru, nBaru, vBaru, kBaru, mBaru, jBaru, sBaru, expBaru, selisihStok) {
    let referensi = currentEditBatchesMobile[0];
    let barang = masterItems.find(i => i.idBatch === idBatchAktif);
    
    // --- SAKLAR RESET KULAKAN BARU ---
    let qtySuntikan = isAddingNewBatchMobile ? sBaru : selisihStok;
    if (qtySuntikan > 0) {
        if (siklusAktif.isLikuidasi) {
            // RESET TOTAL JIKA SURPLUS
            siklusAktif.isLikuidasi = false; 
            siklusAktif.isLanjutanDefisit = false;
            siklusAktif.hutangAwal = 0;
            siklusAktif.modalAwal = 0; siklusAktif.qtyAwal = 0; siklusAktif.uangMasuk = 0;
            siklusAktif.modalTambahan = 0; siklusAktif.qtyTambahan = 0;
        } else if (siklusAktif.isLanjutanDefisit) {
            // MERGE SIKLUS JIKA DEFISIT (Konsep Baru)
            siklusAktif.isLanjutanDefisit = false;
            // Modal, qty, dan hutang lama TETAP DIPERTAHANKAN secara akumulatif
        }
    }
    
     if (isKulakanBaru || isAddingNewBatchMobile) {
        const idBatchBaru = 'B-' + Date.now() + '-' + Math.floor(Math.random()*1000);
        let qtySuntikan = isAddingNewBatchMobile ? sBaru : selisihStok;
        masterItems.unshift({ 
            idBatch: idBatchBaru, dnaInduk: referensi.dnaInduk, barcode: referensi.barcode, qrcode: referensi.qrcode,
            nama: nBaru, varian: vBaru, keterangan: '', kategori: kBaru, modal: mBaru, jual: jBaru, stok: qtySuntikan, expired: expBaru,
            totalModal: qtySuntikan * mBaru
        });
        
        siklusAktif.qtyTambahan += qtySuntikan; 
        siklusAktif.modalTambahan += (qtySuntikan * mBaru);
        if(!isAddingNewBatchMobile) alert("📦 Sukses! Sistem otomatis merakitkan Batch Kulakan Baru di Gudang.");
    } else {
        siklusAktif.qtyTambahan += selisihStok; 
        siklusAktif.modalTambahan += (selisihStok * mBaru);
        barang.modal = mBaru; barang.jual = jBaru; barang.stok = sBaru; barang.expired = expBaru;
        barang.totalModal = sBaru * mBaru; // Kunci ulang total modal jika diedit
        alert("✅ Data berhasil diperbarui!");
    }
    
    masterItems.forEach(m => {
        if (m.dnaInduk === referensi.dnaInduk) { 
             m.nama = nBaru; m.varian = vBaru; m.kategori = kBaru; m.jual = jBaru; 
         }
    });
    
    let bEtalase = etalaseItems.find(i => i.dnaInduk === referensi.dnaInduk || i.nama === referensi.nama);
    if(bEtalase) { 
         bEtalase.dnaInduk = referensi.dnaInduk; bEtalase.nama = nBaru; bEtalase.varian = vBaru; bEtalase.kategori = kBaru; bEtalase.jual = jBaru; 
    } 
    
    saveApotekDB('apotek_masterItems', masterItems); 
    saveApotekDB('apotek_etalaseItems', etalaseItems); 
    saveApotekDB('apotek_siklusAktif', siklusAktif);

    tutupModalMobile('modalEditMobile'); renderGudangMobile(document.getElementById('cariGudangMobile').value); renderBerandaMobile();
}

function simpanEditLanjutanMobile() {
    let nBaru = document.getElementById('editNamaMobile').value; let vBaru = document.getElementById('editVarianMobile').value;
    let kBaru = document.getElementById('editKategoriMobile').value; let mBaru = parseInt(document.getElementById('editModalMobile').value); 
    let jBaru = parseInt(document.getElementById('editJualMobile').value); let sBaru = parseInt(document.getElementById('editStokMobile').value); 
    let expBaru = document.getElementById('editExpiredMobile').value;
    
    if(!nBaru || isNaN(mBaru) || isNaN(jBaru) || isNaN(sBaru)) return alert("Pastikan Nama dan semua Harga terisi angka yang valid!");
    if(mBaru >= jBaru) return alert("Peringatan: Harga Jual tidak boleh lebih kecil/sama dengan Harga Modal.");
    
    if (isAddingNewBatchMobile) {
        eksekusiSimpanEditLanjutanMobile(false, nBaru, vBaru, kBaru, mBaru, jBaru, sBaru, expBaru, 0);
    } else {
        let barang = masterItems.find(i => i.idBatch === idBatchAktif);
        if(!barang) return; let selisihStok = sBaru - barang.stok;
        if (selisihStok > 0 && (expBaru !== barang.expired || mBaru !== barang.modal)) {
            tampilkanConfirmMobile("📦 DETEKSI KULAKAN BARU:\n\nSistem melihat Anda menambah stok (+ " + selisihStok + " Box) sekaligus merubah Tgl Kedaluwarsa/Harga Modal.\n\nApakah ini barang Kulakan Baru? (Klik 'Ya, Lanjut' agar otomatis dibuatkan Batch/Kardus baru).", 
            function() { eksekusiSimpanEditLanjutanMobile(true, nBaru, vBaru, kBaru, mBaru, jBaru, sBaru, expBaru, selisihStok); });
        } else { eksekusiSimpanEditLanjutanMobile(false, nBaru, vBaru, kBaru, mBaru, jBaru, sBaru, expBaru, selisihStok); }
    }
}

// ==========================================
// 10. MESIN HAPUS CERDAS (SMART DELETE BATCH)
// ==========================================
let dnaIndukHapusAktif = null;
let namaObatHapusAktif = null;

function bukaModalHapusCerdas(dnaInduk, namaObat) {
    dnaIndukHapusAktif = dnaInduk;
    namaObatHapusAktif = namaObat;
    
    let batches = masterItems.filter(i => i.dnaInduk === dnaInduk);
    
    if (batches.length <= 1) {
        prosesHapusObatMobile(dnaInduk, namaObat);
    } else {
        document.getElementById('hapusCerdasNamaObat').textContent = namaObat;
        renderListHapusBatchMobile();
        bukaModalMobile('modalHapusCerdasMobile', 'panelHapusCerdasMobile');
    }
}

function renderListHapusBatchMobile() {
    const list = document.getElementById('listHapusCerdasBodyMobile');
    let batches = masterItems.filter(i => i.dnaInduk === dnaIndukHapusAktif);
    
    batches.sort((a, b) => a.idBatch.localeCompare(b.idBatch));
    
    list.innerHTML = batches.map((b, index) => {
        let expText = b.expired ? `<span class="text-red-500 font-bold">${b.expired}</span>` : `<span class="text-slate-400">Tanpa Exp</span>`;
        return `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-sm">
            <div>
                <p class="font-black text-slate-800 text-sm mb-1 uppercase tracking-tight">Batch ${index + 1}</p>
                <p class="text-[10px] text-slate-500 font-medium tracking-wider">Stok Sisa: <span class="font-black text-emerald-600 text-xs">${b.stok}</span> | Exp: ${expText}</p>
            </div>
            <button onclick="prosesHapusBatchSpesifikMobile('${b.idBatch}', ${index + 1})" class="h-10 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-sm flex items-center gap-1.5 shrink-0">
                <i class="fa-solid fa-trash-can"></i> Hapus
            </button>
        </div>`;
    }).join('');
}

function prosesHapusBatchSpesifikMobile(idBatch, urutanBatch) {
    tampilkanConfirmMobile(`Hapus permanen Batch ${urutanBatch} dari obat ${namaObatHapusAktif}?\n\nModal dan stok dari batch ini akan dikeluarkan secara otomatis.`, function() {
        
        let barangYgDihapus = masterItems.find(i => i.idBatch === idBatch);
        if (barangYgDihapus) {
            let nilaiSuntikan = (barangYgDihapus.modal || 0) * (barangYgDihapus.stok || 0);
            siklusAktif.qtyTambahan -= barangYgDihapus.stok;
            siklusAktif.modalTambahan -= nilaiSuntikan;
            if(siklusAktif.qtyTambahan < 0) siklusAktif.qtyTambahan = 0;
            if(siklusAktif.modalTambahan < 0) siklusAktif.modalTambahan = 0;
            saveApotekDB('apotek_siklusAktif', siklusAktif);
        }
        masterItems = masterItems.filter(i => i.idBatch !== idBatch);
        saveApotekDB('apotek_masterItems', masterItems);
        
        let sisaBatches = masterItems.filter(i => i.dnaInduk === dnaIndukHapusAktif);
        if (sisaBatches.length === 0) {
            tutupModalMobile('modalHapusCerdasMobile');
        } else {
            renderListHapusBatchMobile(); 
        }
        
        renderGudangMobile(document.getElementById('cariGudangMobile').value); 
        renderBerandaMobile();
        alert(`✅ Batch ${urutanBatch} berhasil dihapus dari sistem.`);
    });
}

function prosesHapusSemuaBatchMobile() {
    tutupModalMobile('modalHapusCerdasMobile');
    setTimeout(() => {
        prosesHapusObatMobile(dnaIndukHapusAktif, namaObatHapusAktif);
    }, 400); 
}

function prosesHapusObatMobile(dnaInduk, namaObat) {
    tampilkanConfirmMobile(`Hapus permanen obat ${namaObat} beserta SELURUH BATCH-NYA dari Gudang? Aksi ini tidak dapat dibatalkan.`, function() {
        masterItems = masterItems.filter(i => i.dnaInduk !== dnaInduk);
        saveApotekDB('apotek_masterItems', masterItems);
        renderGudangMobile(document.getElementById('cariGudangMobile').value); renderBerandaMobile();
        alert(`✅ Obat ${namaObat} berhasil dihapus dari Gudang.`);
    });
}

// ==========================================
// 11. MESIN TAMBAH OBAT BARU (SMART CALCULATOR)
// ==========================================
function formatAngkaRibuan(inputElement) {
    let rawValue = inputElement.value.replace(/[^0-9]/g, '');
    if(rawValue === '') { inputElement.value = ''; return; }
    inputElement.value = parseInt(rawValue, 10).toLocaleString('id-ID').replace(/,/g, '.');
}

function tampilkanKolomVarianMobile() {
    document.getElementById('wadahVarianMobile').classList.remove('hidden');
}

function toggleKategoriKustomMobile() {
    const selectKategori = document.getElementById('tambahKategoriMobile');
    const inputKustom = document.getElementById('tambahKategoriKustom');
    
    if (selectKategori.value === 'kustom') {
        inputKustom.classList.remove('hidden');
        inputKustom.focus();
    } else {
        inputKustom.classList.add('hidden');
        inputKustom.value = ''; // Bersihkan input jika kembali ke pilihan standar
    }
}

function bukaModalTambahObatMobile() {
    // Reset Form Input & Kembalikan Tombol Rekam Ke Bawaan
    document.getElementById('tambahBarcodeMobile').value = ''; document.getElementById('tambahQrcodeMobile').value = ''; 
    
    ['tambah_qr', 'tambah_barcode'].forEach(tipe => {
        let btn = document.getElementById('btnUI_' + tipe);
        let teks = document.getElementById('teksUI_' + tipe);
        if(btn && teks) {
            btn.className = "w-12 h-12 bg-white text-[#d97706] rounded-2xl flex flex-col items-center justify-center shrink-0 border border-slate-200 shadow-sm active:scale-95 transition-all gap-0.5";
            teks.classList.add('hidden');
            teks.textContent = "Rekam"; // PERBAIKAN: Mengembalikan teks murni agar siklus UI sempurna
        }
    });

    document.getElementById('tambahNamaMobile').value = ''; document.getElementById('tambahVarianMobile').value = '';
    document.getElementById('tambahKategoriMobile').value = ''; document.getElementById('tambahKategoriKustom').value = '';
    document.getElementById('tambahSatuanEceran').value = ''; document.getElementById('tambahSatuanBesar').value = '';
    document.getElementById('tambahQtyBeli').value = ''; document.getElementById('tambahIsiPerSatuan').value = '';
    document.getElementById('tambahToggleBulk').checked = true;
    document.getElementById('tambahModalKotor').value = ''; document.getElementById('tambahJualEceran').value = ''; 
    document.getElementById('tambahExpiredMobile').value = '';
    
    // Sembunyikan elemen kondisional di awal
    document.getElementById('wadahVarianMobile').classList.add('hidden');
    document.getElementById('tambahKategoriKustom').classList.add('hidden');

    // Jalankan Kalkulasi Awal (Reset Label)
    kalkulasiTambahObatCerdas();
    bukaModalMobile('modalTambahObatMobile', 'panelTambahObatMobile');
}

// MESIN PENGGERAK LOGIKA (Dipanggil setiap kali user mengetik)
function kalkulasiTambahObatCerdas() {
    let isBulk = document.getElementById('tambahToggleBulk').checked;
    
    // Ambil Data Input (Buang titik pada uang secara Real-time / FITUR B)
    let satEcer = document.getElementById('tambahSatuanEceran').value || 'Pcs';
    let satBesar = document.getElementById('tambahSatuanBesar').value || 'Box';
    let qtyBeli = parseFloat(document.getElementById('tambahQtyBeli').value) || 0;
    let isiPerSatuan = parseFloat(document.getElementById('tambahIsiPerSatuan').value) || 1;
    
    // Pembersihan Karakter Titik secara aman sebelum diparsing oleh mesin kalkulator
    let modalRaw = document.getElementById('tambahModalKotor').value.replace(/\./g, '');
    let modalKotor = parseFloat(modalRaw) || 0;
    
    let jualRaw = document.getElementById('tambahJualEceran').value.replace(/\./g, '');
    let jualEceran = parseFloat(jualRaw) || 0;

    // UI Saklar Logic (Sembunyikan/Tampilkan Multiplier)
    const wadahMultiplier = document.getElementById('wadahMultiplier');
    const labelModalKotor = document.getElementById('labelModalKotor');
    const labelJualEceran = document.getElementById('labelJualEceran');
    const labelMultiplier = document.getElementById('labelMultiplier');
    const knob = document.querySelector('.toggle-knob');

    if (isBulk) {
        wadahMultiplier.classList.remove('opacity-30', 'pointer-events-none');
        labelMultiplier.textContent = `1 ${satBesar} isi brp ${satEcer}?`;
        labelModalKotor.innerHTML = `Modal (per ${satBesar}) <span class="text-red-500">*</span>`;
        if(knob) knob.style.transform = 'translateX(24px)';
    } else {
        wadahMultiplier.classList.add('opacity-30', 'pointer-events-none');
        labelModalKotor.innerHTML = `Modal (per ${satEcer}) <span class="text-red-500">*</span>`;
        if(knob) knob.style.transform = 'translateX(0px)';
    }
    labelJualEceran.innerHTML = `Jual (per ${satEcer}) <span class="text-red-500">*</span>`;

    // Mesin Hitung Arsitektur Cerdas
    let totalStokEceran = isBulk ? (qtyBeli * isiPerSatuan) : qtyBeli;
    let hppEceran = isBulk ? (modalKotor / (isiPerSatuan || 1)) : modalKotor;
    let tagihanTotal = isBulk ? (qtyBeli * modalKotor) : (qtyBeli * modalKotor);
    let profitEceran = jualEceran - hppEceran;

    // Injeksi Hasil ke Layar (Fact Sheet & Label Otomatis)
    document.getElementById('teksHppOtomatis').textContent = `Otomatis: HPP = ${rupiah(Math.round(hppEceran))} / ${satEcer}`;
    let warnaUntung = profitEceran > 0 ? 'text-[#657e65]' : 'text-red-500';
    document.getElementById('teksEstimasiUntung').innerHTML = `<span class="${warnaUntung}">Est. Keuntungan: ${rupiah(Math.round(profitEceran))} / ${satEcer}</span>`;
    
    document.getElementById('teksVisualStok').textContent = `${totalStokEceran} ${satEcer}`;
    document.getElementById('factSheetStok').textContent = `Total Stok Masuk: ${totalStokEceran} ${satEcer}`;
    document.getElementById('factSheetTagihan').textContent = `Total Tagihan Modal: ${rupiah(tagihanTotal)}`;

   // Simpan data kalkulasi ini ke atribut elemen untuk dihisap oleh prosesSimpanObatBaruMobile
    document.getElementById('tambahQtyBeli').dataset.calculatedStok = totalStokEceran;
    document.getElementById('tambahQtyBeli').dataset.tagihanMutlak = tagihanTotal;
    document.getElementById('tambahModalKotor').dataset.calculatedHpp = hppEceran;
}

function prosesSimpanObatBaruMobile() {
    const barcode = document.getElementById('tambahBarcodeMobile').value.trim(); 
    const qrcode = document.getElementById('tambahQrcodeMobile').value.trim(); 
    const nama = document.getElementById('tambahNamaMobile').value.trim(); 
    
    // TANGKAP NILAI VARIAN DARI INPUT
    const varian = document.getElementById('tambahVarianMobile').value.trim(); 
    
    // LOGIKA KATEGORI KUSTOM
    let kategori = document.getElementById('tambahKategoriMobile').value;
    if (kategori === 'kustom') {
        kategori = document.getElementById('tambahKategoriKustom').value.trim();
        if (!kategori) return alert('⚠️ Kategori manual tidak boleh kosong!');
    }
    
    const jualRaw = document.getElementById('tambahJualEceran').value.replace(/\./g, '');
    const jual = parseFloat(jualRaw) || 0; 
    const expired = document.getElementById('tambahExpiredMobile').value;
    
    // Tarik data hasil kalkulator
    const modal = parseFloat(document.getElementById('tambahModalKotor').dataset.calculatedHpp) || 0;
    const stok = parseFloat(document.getElementById('tambahQtyBeli').dataset.calculatedStok) || 0;
    const tagihanMutlak = parseFloat(document.getElementById('tambahQtyBeli').dataset.tagihanMutlak) || (modal * stok);
    
    // satEcer hanya dipakai untuk notifikasi "Sukses" di bawah, tidak disimpan ke database identitas
    const satEcer = document.getElementById('tambahSatuanEceran').value; 

    // FITUR A: Validasi strict Dropdown Satuan Eceran jika masih kosong (placeholder terpilih)
    if(!satEcer || satEcer === "") return alert('⚠️ Satuan Eceran wajib dipilih!');
    if(!nama || !kategori || isNaN(modal) || isNaN(jual) || stok === 0) return alert('⚠️ Wajib diisi: Nama, Kategori, Jumlah, Modal, dan Jual!');
    if(modal >= jual) return alert('⚠️ Peringatan: Harga Jual Eceran harus lebih tinggi dari HPP Eceran.');
    
    const idBatch = 'B-' + Date.now(); 
    let dnaInduk = '';

    if (qrcode) { dnaInduk = qrcode; } else if (barcode) { dnaInduk = barcode; } 
    else {
        let cekGudang = masterItems.find(m => m.nama.toLowerCase() === nama.toLowerCase());
        if (cekGudang && cekGudang.dnaInduk) { dnaInduk = cekGudang.dnaInduk; } else { dnaInduk = 'DNA-' + Date.now(); }
    }

      // SIMPAN KE MEMORI: `varian` murni mengambil teks varian yang diketik, bukan "Pak/Strip"
    // INJEKSI PECAHAN DINAMIS: Simpan totalModal (tagihanMutlak) agar angka akuntansi terkunci
    masterItems.unshift({ idBatch, dnaInduk, barcode, qrcode, nama, varian: varian, keterangan: '', kategori, modal, jual, stok, expired, totalModal: tagihanMutlak });
    
    if (stok > 0) {
        if (siklusAktif.isLikuidasi) {
            // RESET TOTAL JIKA SURPLUS
            siklusAktif.isLikuidasi = false;
            siklusAktif.isLanjutanDefisit = false;
            siklusAktif.hutangAwal = 0;
            siklusAktif.modalAwal = 0; siklusAktif.qtyAwal = 0; siklusAktif.uangMasuk = 0;
            siklusAktif.modalTambahan = 0; siklusAktif.qtyTambahan = 0;
        } else if (siklusAktif.isLanjutanDefisit) {
            // MERGE SIKLUS JIKA DEFISIT (Konsep Baru)
            siklusAktif.isLanjutanDefisit = false; 
            // Modal, qty, dan hutang lama TETAP DIPERTAHANKAN secara akumulatif
        }
    }
    
    let nilaiSuntikan = tagihanMutlak; 
    
    // SAKLAR ROUTING CERDAS: 
    // Jika belum pernah Tutup Buku sama sekali (waktuStart kosong) = Masuk ke Catatan Awal
    if (!siklusAktif.waktuStart && siklusAktif.qtyAwal === 0 && siklusAktif.qtyTambahan === 0) { 
         siklusAktif.modalAwal += nilaiSuntikan; 
         siklusAktif.qtyAwal += stok; 
    } 
    // Jika sudah pernah Tutup Buku (waktuStart ada) = Semua entitas dipaksa masuk ke Catatan Tambahan
    else { 
         siklusAktif.modalTambahan += nilaiSuntikan; 
         siklusAktif.qtyTambahan += stok; 
    }

    saveApotekDB('apotek_masterItems', masterItems); 
    saveApotekDB('apotek_siklusAktif', siklusAktif);

    tutupModalMobile('modalTambahObatMobile'); renderGudangMobile(document.getElementById('cariGudangMobile').value); renderBerandaMobile();
    alert('✅ Sukses! ' + stok + ' ' + satEcer + ' ' + nama + ' berhasil ditambahkan ke Gudang.');
}

// ==========================================
// 12. MESIN KASIR & KERANJANG (POINT OF SALE)
// ==========================================
let keranjangKasirMobile = [];

function toggleDropdownKasir() { document.getElementById('dropdownKasirList').classList.toggle('hidden'); }

function pilihObatDariDropdown(namaObat) {
    document.getElementById('dropdownKasirList').classList.add('hidden');
    let barang = etalaseItems.find(e => e.nama === namaObat);
    if(barang) masukkanKeKeranjangMobile(barang);
}

function bukaModalKasirMobile() {
    keranjangKasirMobile = []; renderKeranjangMobile();
    const list = document.getElementById('dropdownKasirList');
    list.innerHTML = '';
    let adaBarang = false;
    
    etalaseItems.forEach(item => { 
        if(item.stok > 0) { 
            // SUNTIKAN: Merakit Nama + Varian + Kategori secara elegan dalam satu baris
            let teksVarian = item.varian ? ` <span class="text-slate-400 font-medium">${item.varian}</span>` : '';
            let teksKategori = item.kategori ? ` <span class="text-[9px] uppercase font-black text-corporate-500">• ${item.kategori}</span>` : '';
            
            list.innerHTML += `<button onclick="pilihObatDariDropdown('${item.nama}')" class="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex justify-between items-center"><div class="leading-tight"><span class="font-bold text-slate-800 text-xs">${item.nama}</span>${teksVarian}${teksKategori}</div><span class="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shrink-0 ml-2">Sisa ${item.stok}</span></button>`; 
            adaBarang = true; 
        } 
    });
    
    if(!adaBarang) {
         list.innerHTML = `<div class="p-4 text-center text-xs font-bold text-slate-400">Etalase Kosong</div>`;
         return alert("⚠️ Etalase masih kosong! Masuk ke menu Gudang lalu transfer stok ke Etalase.");
    }
    
    document.querySelector('input[value="Tunai"]').checked = true; toggleFormKasbonMobile();
    bukaModalMobile('modalKasirMobile', 'panelKasirMobile');
}

let toastTimeoutMobile;
function showToast(pesan) {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    if(!toast || !toastMsg) return;
    toastMsg.innerHTML = pesan;
    toast.classList.remove('opacity-0', '-translate-y-10'); toast.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(toastTimeoutMobile);
    toastTimeoutMobile = setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0'); toast.classList.add('opacity-0', '-translate-y-10');
    }, 2000);
}

function masukkanKeKeranjangMobile(barang) {
    let index = keranjangKasirMobile.findIndex(k => k.nama === barang.nama);
    if(index !== -1) {
        if(keranjangKasirMobile[index].qty < barang.stok) { 
            keranjangKasirMobile[index].qty++; 
            showToast(`✅ ${barang.nama} ditambahkan. Total di keranjang: ${keranjangKasirMobile[index].qty} stok.`);
            triggerHaptic([50, 100]);
        } else { alert("⚠️ Sisa stok " + barang.nama + " tidak cukup!"); }
    } else {
        // SUNTIKAN: Membawa serta 'kategori' masuk ke dalam kantong belanja
        keranjangKasirMobile.push({ nama: barang.nama, varian: barang.varian, keterangan: barang.keterangan, kategori: barang.kategori, jual: barang.jual, qty: 1, stokMax: barang.stok });
        showToast(`✅ 1 stok ${barang.nama} berhasil masuk keranjang.`);
        triggerHaptic([50, 100]);
    }
    renderKeranjangMobile();
}

function ubahQtyKeranjangMobile(index, delta) {
    let item = keranjangKasirMobile[index]; let newQty = item.qty + delta;
    if(newQty > item.stokMax) return alert("Sisa stok hanya " + item.stokMax);
    if(newQty <= 0) { keranjangKasirMobile.splice(index, 1); } else { item.qty = newQty; }
    renderKeranjangMobile();
}

function renderKeranjangMobile() {
    const tbody = document.getElementById('keranjangBodyMobile'); let total = 0;
    if(keranjangKasirMobile.length === 0) {
        tbody.innerHTML = `
            <div class="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50/50">
                <div class="w-14 h-14 mx-auto bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-3">
                    <i class="fa-solid fa-basket-shopping text-2xl text-slate-300"></i>
                </div>
                <p class="text-[11px] font-black text-slate-700 uppercase tracking-widest mb-1">Keranjang Kosong</p>
                <p class="text-[9px] text-slate-500 font-medium">Pilih obat dari etalase atas atau<br>tekan tombol Scanner Scanner</p>
            </div>`;
    } else {
        tbody.innerHTML = keranjangKasirMobile.map((k, i) => {
            let sub = k.jual * k.qty; total += sub;
            let ketTeks = (k.varian || k.keterangan) ? `<p class="text-[9px] text-slate-500 italic mt-0.5">${k.varian || ''} ${k.keterangan || ''}</p>` : '';
            return `<div class="px-4 py-3 bg-white flex items-center justify-between gap-3 border-b border-slate-50 last:border-0"><div class="flex-1 pr-2"><h4 class="font-bold text-slate-800 text-xs leading-tight">${k.nama}</h4>${ketTeks}<p class="font-black text-corporate-600 text-sm mt-1">${rupiah(sub)}</p></div><div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-inner shrink-0"><button onclick="ubahQtyKeranjangMobile(${i}, -1)" class="w-7 h-7 rounded-lg bg-white shadow-sm text-slate-600 font-bold active:bg-slate-100 transition">-</button><span class="w-5 text-center font-black text-slate-800 text-xs">${k.qty}</span><button onclick="ubahQtyKeranjangMobile(${i}, 1)" class="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 shadow-sm text-emerald-600 font-bold active:bg-emerald-100 transition">+</button></div></div>`;
        }).join('');
    }
    document.getElementById('kasirTotalMobile').textContent = rupiah(total);
}

function toggleFormKasbonMobile() {
    const metode = document.querySelector('input[name="kasirMetodeMobile"]:checked').value;
    const formIdentitas = document.getElementById('formKasbonMobile');
    if(metode === 'Debt') { formIdentitas.classList.remove('hidden'); } else { formIdentitas.classList.add('hidden'); document.getElementById('kasbonNamaMobile').value = ''; document.getElementById('kasbonWaMobile').value = ''; }
}

function prosesBayarMobile() {
    if(keranjangKasirMobile.length === 0) return alert('Keranjang masih kosong!');
    const metode = document.querySelector('input[name="kasirMetodeMobile"]:checked').value;
    let namaPelanggan = ''; let waPelanggan = '';
    if(metode === 'Debt') {
        namaPelanggan = document.getElementById('kasbonNamaMobile').value; waPelanggan = document.getElementById('kasbonWaMobile').value;
        if(!namaPelanggan) return alert('Nama pelanggan wajib diisi untuk Kasbon!');
    }
    
    let totalBelanja = 0, totalLaba = 0, totalItem = 0; let namaObatGabungan = [];
    keranjangKasirMobile.forEach(k => {
        totalBelanja += (k.jual * k.qty); totalItem += k.qty; 
        let namaLengkap = k.nama; if(k.varian || k.keterangan) namaLengkap += ` (${k.varian || ''} ${k.keterangan || ''})`; namaObatGabungan.push(namaLengkap);
        
        let bEtalase = etalaseItems.find(e => e.nama === k.nama); let totalModalItemIni = 0; let sisaQtyDipotong = k.qty;
        if(bEtalase) {
            bEtalase.stok -= k.qty;
            if(bEtalase.antreanFIFO && bEtalase.antreanFIFO.length > 0) {
              for(let i = 0; i < bEtalase.antreanFIFO.length; i++) {
                    let batch = bEtalase.antreanFIFO[i];
                    if(batch.stok > 0) { 
                        let ambil = Math.min(sisaQtyDipotong, batch.stok); 
                        
                        // --- MESIN PECAHAN DINAMIS (ETALASE -> PENJUALAN) ---
                        let modalSisa = batch.totalModal !== undefined ? batch.totalModal : (batch.modal * batch.stok);
                        let nilaiModalTerjual = Math.round((ambil / batch.stok) * modalSisa);
                        
                        if (batch.totalModal !== undefined) batch.totalModal -= nilaiModalTerjual;
                        batch.stok -= ambil; 
                        sisaQtyDipotong -= ambil; 
                        totalModalItemIni += nilaiModalTerjual; 
                        
                        if(sisaQtyDipotong <= 0) break; 
                    }
                }
                bEtalase.antreanFIFO = bEtalase.antreanFIFO.filter(b => b.stok > 0);
            } else { let bMaster = masterItems.find(m => m.nama === k.nama); totalModalItemIni = (bMaster ? bMaster.modal : 0) * k.qty; }
        }
     totalLaba += ((k.jual * k.qty) - totalModalItemIni);
        k.hppSatuan = Math.round(totalModalItemIni / k.qty); // SIMPAN HPP UNTUK RETUR
        k.hppTotalModal = totalModalItemIni; // Kunci total modal absolut untuk retur yang presisi
    });

    
    if (metode !== 'Debt') siklusAktif.uangMasuk += totalBelanja; 
    
    const tglWaktu = new Date();
    const strWaktu = tglWaktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const strTglLokal = getTanggalLokal();
    
    // [PENYEMPURNAAN 1] MESIN AUTO-SPLIT KHUSUS KASBON (DEBT)
    if (metode === 'Debt' && keranjangKasirMobile.length > 0) {
        keranjangKasirMobile.forEach((k, index) => {
            let subTotal = k.jual * k.qty;
            let subLaba = subTotal - (k.hppSatuan * k.qty);
            let namaKet = k.nama + (k.varian ? ` ${k.varian}` : '');
            
            cashierHistory.unshift({ 
                id: Date.now() + index, // ID unik per item
                tanggal: strTglLokal, waktu: strWaktu, 
                obat: namaKet, detailKeranjang: [JSON.parse(JSON.stringify(k))], 
                kasir: 'Pemilik', item: k.qty, total: subTotal, metode: metode, laba: subLaba, pelanggan: namaPelanggan, wa: waPelanggan, isPelunasan: false 
            });
        });
    } else {
        // JIKA BUKAN KASBON, TETAP 1 STRUK GABUNGAN SEPERTI BIASA
        const namaObatFinal = namaObatGabungan.length > 1 ? `${namaObatGabungan[0]} + ${namaObatGabungan.length - 1} lainnya` : namaObatGabungan[0];
        cashierHistory.unshift({ 
            id: Date.now(), tanggal: strTglLokal, waktu: strWaktu, 
            obat: namaObatFinal, detailKeranjang: JSON.parse(JSON.stringify(keranjangKasirMobile)), 
            kasir: 'Pemilik', item: totalItem, total: totalBelanja, metode: metode, laba: totalLaba, pelanggan: namaPelanggan, wa: waPelanggan, isPelunasan: false 
        });
    }
    
    const namaNotifFinal = namaObatGabungan.length > 1 ? `${namaObatGabungan[0]} + ${namaObatGabungan.length - 1} lainnya` : namaObatGabungan[0];
    
    // TEMBAKKAN ALARM NOTIFIKASI (BUG FIXED: namaObatFinal diganti menjadi namaNotifFinal)
    if (metode === 'Debt') {
        kirimNotifikasiMobile('Kasbon / Piutang', `${namaNotifFinal} berstatus kasbon atas nama ${namaPelanggan}.`, 'piutang', totalBelanja);
    } else {
        kirimNotifikasiMobile('Pembelian Baru', `${namaNotifFinal} laku terjual secara ${metode}.`, 'beli', totalBelanja);
    }

    saveApotekDB('apotek_etalaseItems', etalaseItems); 
    saveApotekDB('apotek_cashierHistory', cashierHistory); 
    saveApotekDB('apotek_siklusAktif', siklusAktif);

    tutupModalMobile('modalKasirMobile'); renderBerandaMobile(); 
    if(!document.getElementById('layar-gudang').classList.contains('hidden')) renderGudangMobile(document.getElementById('cariGudangMobile').value);
    if(!document.getElementById('layar-etalase').classList.contains('hidden')) renderEtalaseMobile();
    triggerHaptic([100, 50, 100]);
    alert(`✅ Transaksi ${metode} Berhasil! Omzet telah masuk ke Beranda.`);
}

function prosesBatalTransaksiMobile(idTransaksi) {
    tampilkanConfirmMobile("Batalkan transaksi ini?\n\nJika ini penjualan biasa, uang ditarik & obat diretur. Jika ini Pelunasan, utang akan dihidupkan kembali tanpa mengacaukan stok.", function() {
        const trx = cashierHistory.find(t => t.id === idTransaksi);
        if (trx) {
            
            // [CELAH 1] LOGIKA BATAL KHUSUS PELUNASAN GABUNGAN
            if (trx.isPelunasan) {
                siklusAktif.uangMasuk -= (trx.total || 0); 
                if (siklusAktif.uangMasuk < 0) siklusAktif.uangMasuk = 0;
                
                // Bangkitkan Utang Lama (Multi-ID) dari Tali Pusar
                if (trx.idTerkait) {
                    let listIdUtang = trx.idTerkait.toString().split(',');
                    cashierHistory.forEach(t => {
                        if(listIdUtang.includes(t.id.toString())) {
                            t.statusLunas = false;
                            delete t.idTerkait; 
                        }
                    });
                }
                kirimNotifikasiMobile('Batal Pelunasan', `Pelunasan ${trx.pelanggan || ''} dibatalkan. Utang aktif kembali.`, 'batal', trx.total);
                
            } else {
                // LOGIKA LAMA: BATAL TRANSAKSI PENJUALAN BIASA (TUNAI/QRIS)
                if (trx.metode !== 'Debt') { 
                    siklusAktif.uangMasuk -= (trx.total || 0); 
                    if (siklusAktif.uangMasuk < 0) siklusAktif.uangMasuk = 0; 
                }
                
                // Kembalikan Stok ke Etalase
                if (trx.detailKeranjang && trx.detailKeranjang.length > 0) {
                    trx.detailKeranjang.forEach(itemRetur => {
                        let bEtalase = etalaseItems.find(i => i.nama === itemRetur.nama);
                        let idBatchRetur = 'RETUR-' + Date.now() + '-' + Math.floor(Math.random() * 1000); 
                        
                        let modalReturKembali = itemRetur.hppTotalModal !== undefined ? itemRetur.hppTotalModal : ((itemRetur.hppSatuan || (itemRetur.jual * 0.8)) * itemRetur.qty);
                        if (bEtalase) { 
                            bEtalase.stok += itemRetur.qty; if(!bEtalase.antreanFIFO) bEtalase.antreanFIFO = [];
                            bEtalase.antreanFIFO.unshift({ idBatch: idBatchRetur, modal: itemRetur.hppSatuan || (itemRetur.jual * 0.8), stok: itemRetur.qty, expired: '', totalModal: modalReturKembali });
                        } else {
                            etalaseItems.push({ dnaInduk: 'DNA-RETUR-' + Date.now(), nama: itemRetur.nama, kategori: '⚠️ Barang Retur', jual: itemRetur.jual, stok: itemRetur.qty, antreanFIFO: [{ idBatch: idBatchRetur, modal: itemRetur.hppSatuan || (itemRetur.jual * 0.8), stok: itemRetur.qty, expired: '', totalModal: modalReturKembali }] }); 
                        }
                    });
                } else { 
                    let qty = trx.item || 1; let hppRetur = Math.round(((trx.total || 0) - (trx.laba || 0)) / qty);
                    etalaseItems.push({ dnaInduk: 'DNA-RETUR-OLD', nama: trx.obat, kategori: '⚠️ Barang Retur', jual: Math.round((trx.total || 0) / qty), stok: qty, antreanFIFO: [{ idBatch: 'RETUR-OLD', modal: hppRetur, stok: qty, expired: '' }] });
                }
                kirimNotifikasiMobile('Transaksi Batal', `Pembelian ${trx.obat} telah dibatalkan.`, 'batal', trx.total);
            }
            
            // Eksekusi Pemusnahan ID dari History
            cashierHistory = cashierHistory.filter(t => t.id !== idTransaksi);

            saveApotekDB('apotek_etalaseItems', etalaseItems); 
            saveApotekDB('apotek_cashierHistory', cashierHistory); 
            saveApotekDB('apotek_siklusAktif', siklusAktif);

            renderRiwayatMobile(); renderBerandaMobile(); 
            if(!document.getElementById('layar-piutang').classList.contains('hidden')) renderPiutangMobile();
            
            triggerHaptic([100,50,100]);
            alert(trx.isPelunasan ? "✅ Batal Pelunasan Berhasil! Utang dihidupkan kembali secara presisi (Stok tidak disentuh)." : "✅ Transaksi Dibatalkan. Stok setiap item diretur ke Etalase.");
        }
    });
}

// ==========================================
// 13. MESIN LACAK STRUK & PENAGIHAN WA
// ==========================================
function bukaModalLacakMobile() {
    document.getElementById('inputLacakIDMobile').value = ''; document.getElementById('hasilLacakAreaMobile').classList.add('hidden');
    bukaModalMobile('modalLacakMobile', 'panelLacakMobile');
}

function prosesLacakIDMobile() {
    const inputID = parseInt(document.getElementById('inputLacakIDMobile').value);
    const area = document.getElementById('hasilLacakAreaMobile');
    if(!inputID) return alert("⚠️ Ketik nomor ID transaksi yang valid!");
    
    const trx = cashierHistory.find(t => t.id === inputID);
    area.classList.remove('hidden');
    
    if(!trx) { area.innerHTML = `<div class="text-center p-4 bg-red-50 rounded-2xl border border-red-100"><i class="fa-solid fa-file-circle-xmark text-3xl text-red-300 mb-2 block"></i><p class="text-xs font-bold text-red-600">ID Transaksi tidak ditemukan.</p></div>`; return; }
    
    let statusHtml = '';
    if (trx.metode === 'Debt') {
        if(trx.statusLunas) statusHtml = `<div class="bg-emerald-50 border border-emerald-200 p-3 rounded-xl mt-3"><p class="text-[9px] font-black text-emerald-600 uppercase mb-1 tracking-wider"><i class="fa-solid fa-check-circle"></i> SUDAH DILUNASI</p><p class="text-[11px] text-emerald-800 font-medium leading-tight">Utang telah dibayar via ${trx.idTerkait || '-'}</p></div>`;
        else statusHtml = `<div class="bg-red-50 border border-red-200 p-3 rounded-xl mt-3"><p class="text-[9px] font-black text-red-600 uppercase mb-1 tracking-wider"><i class="fa-solid fa-triangle-exclamation"></i> BELUM BAYAR</p><p class="text-[11px] text-red-800 font-medium leading-tight">Faktur kasbon ini masih menunggak.</p></div>`;
    } else if (trx.isPelunasan) {
        statusHtml = `<div class="bg-blue-50 border border-blue-200 p-3 rounded-xl mt-3"><p class="text-[9px] font-black text-blue-600 uppercase mb-1 tracking-wider"><i class="fa-solid fa-link"></i> BUKTI PELUNASAN</p><p class="text-[11px] text-blue-800 font-medium leading-tight">Nota terima uang untuk Faktur ID: ${trx.idTerkait || '-'}</p></div>`;
    } else {
        statusHtml = `<div class="bg-slate-50 border border-slate-200 p-3 rounded-xl mt-3"><p class="text-[9px] font-black text-slate-600 uppercase mb-1 tracking-wider"><i class="fa-solid fa-check"></i> TRANSAKSI LUNAS</p><p class="text-[11px] text-slate-600 font-medium leading-tight">Pembelian putus via ${trx.metode}.</p></div>`;
    }
    
    area.innerHTML = `<div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><h4 class="font-black text-corporate-900 text-sm mb-1 tracking-tight">Rincian Struk</h4><div class="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-3 border-b border-slate-100 pb-2"><span><i class="fa-regular fa-clock"></i> ${trx.tanggal} (${trx.waktu})</span><span>Kasir: ${trx.kasir}</span></div><p class="text-xs font-bold text-slate-800 leading-tight">${trx.obat}</p><p class="text-2xl font-black text-corporate-700 mt-2">${rupiah(trx.total)}</p>${statusHtml}</div>`;
}

function tagihViaWAMobile(idTransaksi) {
    const trx = cashierHistory.find(t => t.id === idTransaksi);
    if (!trx || !trx.wa) return alert("⚠️ Nomor WhatsApp pelanggan tidak ditemukan!");
    
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); canvas.width = 400; canvas.height = 460;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center';
    ctx.font = '900 24px monospace'; ctx.fillText(profilApotek.nama.toUpperCase().substring(0,25), 200, 45);
    ctx.font = '600 14px monospace'; ctx.fillText((profilApotek.alamat || '').substring(0,40), 200, 70);
    ctx.font = '14px monospace'; ctx.fillText('====================================', 200, 95);
    ctx.font = '900 18px monospace'; ctx.fillText('BUKTI KASBON / PIUTANG', 200, 125);
    ctx.font = '14px monospace'; ctx.fillText('====================================', 200, 145);
    
    ctx.textAlign = 'left'; let y = 180; ctx.font = '600 14px monospace';
    ctx.fillText(`No. Trx : ${trx.id}`, 25, y); y += 25; ctx.fillText(`Waktu   : ${trx.tanggal} (${trx.waktu})`, 25, y); y += 25;
    ctx.fillText(`Kasir   : ${trx.kasir}`, 25, y); y += 30; ctx.fillText(`Yth.    : ${(trx.pelanggan || '').toUpperCase()}`, 25, y); y += 35;
    
    ctx.textAlign = 'center'; ctx.fillText('------------------------------------', 200, y); y += 30;
    ctx.textAlign = 'left'; ctx.font = '900 15px monospace'; ctx.fillText(`${trx.obat}`, 25, y); y += 25;
    ctx.font = '600 14px monospace'; ctx.fillText(`${trx.item} Item Obat`, 25, y);
    ctx.textAlign = 'right'; ctx.fillText(`${rupiah(trx.total)}`, 375, y); y += 35;
    
    ctx.textAlign = 'center'; ctx.font = '14px monospace'; ctx.fillText('------------------------------------', 200, y); y += 35;
    ctx.textAlign = 'left'; ctx.font = '900 18px monospace'; ctx.fillText('TOTAL TAGIHAN:', 25, y);
    ctx.textAlign = 'right'; ctx.fillStyle = '#dc2626'; ctx.fillText(`${rupiah(trx.total)}`, 375, y); y += 45;
    
    ctx.fillStyle = '#64748b'; ctx.textAlign = 'center'; ctx.font = 'italic 12px monospace';
    ctx.fillText('Struk digital ini adalah bukti sah', 200, y); y += 20; ctx.fillText('dari ' + profilApotek.nama, 200, y);
    
    let noWA = trx.wa.toString().replace(/\D/g, ''); if (noWA.startsWith('0')) { noWA = '62' + noWA.substring(1); } else if (noWA.startsWith('8')) { noWA = '62' + noWA; }
    
    const pesanTeks = `Halo Bapak/Ibu *${trx.pelanggan || 'Pelanggan'}*,\n\nKami dari *${profilApotek.nama}* memohon izin mengingatkan catatan kasbon/piutang yang belum diselesaikan.\n*(Struk Terlampir)*\n\nMohon kerjasamanya untuk dapat melakukan pelunasan di tempat kami.\nTerima kasih! ├░┼╕тДв┬П`;
    
    canvas.toBlob(async (blob) => {
        const namaFile = `Tagihan_${(trx.pelanggan || 'Apotek').replace(/\s+/g, '_')}.png`; const fileGambar = new File([blob], namaFile, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [fileGambar] })) {
            try { await navigator.share({ files: [fileGambar], title: 'Tagihan Apotek', text: pesanTeks }); } catch (err) { console.log(err); }
        } else {
            alert("✅ Gambar struk akan diunduh. Silakan kirim (Drag & Drop) gambar tersebut ke WhatsApp yang akan terbuka.");
            const linkDownload = document.createElement('a'); linkDownload.href = URL.createObjectURL(blob); linkDownload.download = namaFile; linkDownload.click();
            setTimeout(() => { window.open(`https://api.whatsapp.com/send?phone=${noWA}&text=${encodeURIComponent(pesanTeks)}`, '_blank'); }, 800);
        }
    }, 'image/png');
}

// ==========================================
// 14. MESIN TRUK LOGISTIK (TRANSFER MASAL)
// ==========================================
function bukaModalTransferMasalMobile() {
    const list = document.getElementById('listTransferMasalBodyMobile');
    let barangTersedia = masterItems.filter(o => o.stok > 0 && o.nama !== '___SYSTEM_AUTH___' && o.kategori !== '⚠️ Barang Retur');
    
    if(barangTersedia.length === 0) {
        return alert("Gudang kosong! Tidak ada barang yang bisa ditransfer.");
    }
    
    let grouped = {};
    barangTersedia.forEach(o => {
        if(!grouped[o.dnaInduk]) {
            grouped[o.dnaInduk] = { dnaInduk: o.dnaInduk, nama: o.nama, kategori: o.kategori, jual: o.jual, totalStok: 0 };
        }
        grouped[o.dnaInduk].totalStok += o.stok;
    });
    
    let groupedArray = Object.values(grouped);
    list.innerHTML = groupedArray.map((g, index) => {
        return `
        <div class="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl shadow-sm mb-2">
            <div class="flex-1 pr-2">
                <p class="font-bold text-sm text-slate-800 leading-tight">${g.nama}</p>
                <p class="text-[10px] text-slate-500 mt-1">Total di Gudang: <span class="font-black text-emerald-600">${g.totalStok}</span></p>
            </div>
            <div class="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 shrink-0">
                <button type="button" onclick="ubahJumlahMasalMobile('masalM-${index}', -1)" class="h-8 w-8 rounded-lg bg-white shadow-sm text-slate-600 font-black active:bg-slate-200">-</button>
                <input type="number" id="masalM-${index}" data-dna="${g.dnaInduk}" value="0" min="0" max="${g.totalStok}" class="w-10 bg-transparent text-center font-black text-slate-800 text-sm focus:outline-none input-masal-transfer">
                <button type="button" onclick="ubahJumlahMasalMobile('masalM-${index}', 1)" class="h-8 w-8 rounded-lg bg-emerald-100 shadow-sm text-emerald-700 font-black active:bg-emerald-200">+</button>
            </div>
        </div>`;
    }).join('');
    
    bukaModalMobile('modalTransferMasalMobile', 'panelTransferMasalMobile');
}

function ubahJumlahMasalMobile(idInput, delta) {
    let input = document.getElementById(idInput);
    let val = parseInt(input.value) || 0;
    let max = parseInt(input.getAttribute('max')) || 0;
    let newVal = val + delta;
    if (newVal < 0) newVal = 0;
    if (newVal > max) newVal = max;
    input.value = newVal;
}

function prosesTransferMasalMobile() {
    let adaYangDitransfer = false;
    let inputs = document.querySelectorAll('.input-masal-transfer'); 
    
    inputs.forEach(input => {
        let val = parseInt(input.value) || 0;
        let dnaInduk = input.getAttribute('data-dna');
        
        if (val > 0) {
            let batchesGudang = masterItems.filter(i => i.dnaInduk === dnaInduk && i.stok > 0);
            let totalStokGudang = batchesGudang.reduce((sum, b) => sum + b.stok, 0);
            
            if (val <= totalStokGudang) {
                adaYangDitransfer = true;
                batchesGudang.sort((a, b) => new Date(a.expired || '2099-12-31') - new Date(b.expired || '2099-12-31'));
                
                let sisaYgHarusDipindah = val;
                let namaObat = batchesGudang[0].nama;
                
                let barangEtalase = etalaseItems.find(e => e.dnaInduk === dnaInduk || e.nama === namaObat);
                if(!barangEtalase) { 
                     barangEtalase = { dnaInduk: dnaInduk, nama: namaObat, kategori: batchesGudang[0].kategori, jual: batchesGudang[0].jual, varian: batchesGudang[0].varian, stok: 0, antreanFIFO: [] };
                    etalaseItems.push(barangEtalase); 
                 }
                
                for (let i = 0; i < batchesGudang.length; i++) {
                    let batch = batchesGudang[i];
                    if (sisaYgHarusDipindah <= 0) break;
                    
                      let jumlahDiambil = Math.min(batch.stok, sisaYgHarusDipindah);
            
            // --- MESIN PECAHAN DINAMIS (GUDANG -> ETALASE) ---
            let modalSisa = batch.totalModal !== undefined ? batch.totalModal : (batch.modal * batch.stok);
            let nilaiModalDipindah = Math.round((jumlahDiambil / batch.stok) * modalSisa);
            
            if (batch.totalModal !== undefined) batch.totalModal -= nilaiModalDipindah;
            batch.stok -= jumlahDiambil;
            sisaYgHarusDipindah -= jumlahDiambil;
            
            barangEtalase.stok += jumlahDiambil;
            
            if(!barangEtalase.antreanFIFO) barangEtalase.antreanFIFO = [];
            let batchSamaDiEtalase = barangEtalase.antreanFIFO.find(b => b.idBatch === batch.idBatch);
            
            if(batchSamaDiEtalase) { 
                 batchSamaDiEtalase.stok += jumlahDiambil; 
                 if (batchSamaDiEtalase.totalModal !== undefined) batchSamaDiEtalase.totalModal += nilaiModalDipindah;
             } else { 
                 barangEtalase.antreanFIFO.push({ idBatch: batch.idBatch, modal: batch.modal, stok: jumlahDiambil, expired: batch.expired, totalModal: nilaiModalDipindah }); 
             }

                }
                barangEtalase.antreanFIFO.sort((a, b) => new Date(a.expired || '2099-12-31') - new Date(b.expired || '2099-12-31'));
            }
        }
    });
    
    if(adaYangDitransfer) {
        saveApotekDB('apotek_masterItems', masterItems); 
        saveApotekDB('apotek_etalaseItems', etalaseItems);

        tutupModalMobile('modalTransferMasalMobile');
        renderGudangMobile(document.getElementById('cariGudangMobile').value); 
        renderBerandaMobile();
        triggerHaptic([100, 50, 100]);
        alert("📦 Barang berhasil diberangkatkan ke Etalase secara Cerdas!");
    } else { alert("Pilih minimal 1 barang untuk ditransfer."); }
}

// ==========================================
// 15. MESIN SETELAN PROFIL
// ==========================================
function bukaModalSetelanMobile() {
    document.getElementById('setNamaMobile').value = profilApotek.nama; 
    document.getElementById('setAlamatMobile').value = profilApotek.alamat || ''; 
    document.getElementById('setTelpMobile').value = profilApotek.telepon || '';
    bukaModalMobile('modalSetelanMobile', 'panelSetelanMobile');
}

function prosesSimpanSetelanMobile() {
    let nama = document.getElementById('setNamaMobile').value; 
    let alamat = document.getElementById('setAlamatMobile').value; 
    let telp = document.getElementById('setTelpMobile').value;
    if(!nama || !alamat) return alert("⚠️ Nama Apotek dan Alamat wajib diisi!");
    
    profilApotek.nama = nama; profilApotek.alamat = alamat; profilApotek.telepon = telp;
    
    saveApotekDB('apotek_profilData', profilApotek);
    
    document.getElementById('namaApotekHeader').innerText = nama; 
    tutupModalMobile('modalSetelanMobile'); alert("✅ Profil Apotek berhasil diperbarui!");
}

// ==========================================
// 16. MESIN PEMINDAI SENSOR KARTU & BARCODE (VIRTUAL ID)
// ==========================================
let html5QrcodeScannerMobile = null; let targetScannerAktif = 'kasir';

function bukaScannerKameraMobile(target = 'kasir') {
    targetScannerAktif = target;
    const modalScan = document.getElementById('modalScannerKamera'); modalScan.classList.remove('hidden');
    html5QrcodeScannerMobile = new Html5Qrcode("readerMobile");
    const config = { fps: 10, qrbox: { width: 250, height: 100 }, aspectRatio: 1.0 };
    
    html5QrcodeScannerMobile.start({ facingMode: "environment" }, config, (decodedText) => {
        tutupKameraScannerMobile(); triggerHaptic(200); 
        
        if (targetScannerAktif === 'tambah_qr' || targetScannerAktif === 'tambah_barcode') {
            let barangSudahAda = masterItems.find(m => m.barcode === decodedText || m.qrcode === decodedText);
            if (barangSudahAda) {
                document.getElementById('tambahBarcodeMobile').value = ''; document.getElementById('tambahQrcodeMobile').value = '';
                munculkanAlertPencegatanMobile(barangSudahAda.nama, barangSudahAda.dnaInduk);
            } else {
                if(targetScannerAktif === 'tambah_qr') document.getElementById('tambahQrcodeMobile').value = decodedText;
                else document.getElementById('tambahBarcodeMobile').value = decodedText;
                
                // Ubah Visual Tombol Menjadi Hijau Terekam
                let btn = document.getElementById('btnUI_' + targetScannerAktif);
                let teks = document.getElementById('teksUI_' + targetScannerAktif);
                if(btn && teks) {
                    btn.className = "w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex flex-col items-center justify-center shrink-0 border-2 border-emerald-500 shadow-sm active:scale-95 transition-all gap-0.5";
                    teks.classList.remove('hidden');
                    teks.textContent = "TEREKAM";
                }
                
                alert("✅ Kode berhasil direkam ke sistem! Silakan lengkapi sisa data obat.");
            }
        } else if (targetScannerAktif === 'lacak') {
            let match = decodedText.match(/Trx:\s*(\d+)/);
            if(match && match[1]) { document.getElementById('inputLacakIDMobile').value = match[1]; prosesLacakIDMobile(); } else { alert("⚠️ QR Code bukan struk valid."); }
        } else {
            let barangMaster = masterItems.find(m => m.barcode === decodedText || m.qrcode === decodedText);
            if(barangMaster) {
                let bEtalase = etalaseItems.find(e => e.nama === barangMaster.nama);
                if(bEtalase && bEtalase.stok > 0) { 
                    // Visual Animasi Hijau Scanner Kasir
                    let btnScan = document.getElementById('btnScannerKasir');
                    if(btnScan) {
                        btnScan.classList.replace('bg-orange-50', 'bg-emerald-500');
                        btnScan.classList.replace('border-orange-200', 'border-emerald-600');
                        btnScan.classList.replace('text-orange-500', 'text-white');
                        setTimeout(() => {
                            btnScan.classList.replace('bg-emerald-500', 'bg-orange-50');
                            btnScan.classList.replace('border-emerald-600', 'border-orange-200');
                            btnScan.classList.replace('text-white', 'text-orange-500');
                        }, 800);
                    }
                    masukkanKeKeranjangMobile(bEtalase); 
                } else { alert("⚠️ STOK KOSONG di Etalase!"); }
            } else { alert("⚠️ Barcode tidak terdaftar!"); }
        }
    }).catch(err => { alert("Kamera gagal diakses."); tutupKameraScannerMobile(); });
}

function munculkanAlertPencegatanMobile(namaBarang, dnaInduk) {
    document.getElementById('alertPencegatanNamaMobile').textContent = namaBarang;
    let batches = masterItems.filter(m => m.dnaInduk === dnaInduk); batches.sort((a, b) => a.idBatch.localeCompare(b.idBatch));
    
    let listHTML = batches.map((b, index) => {
        let expText = b.expired ? `Exp: ${b.expired}` : 'Tanpa Exp';
        return `<div class="bg-white border border-slate-200 p-2 rounded-xl mb-1.5 flex justify-between items-center shadow-sm"><span class="font-black text-slate-700">Batch ${index + 1}</span><span class="text-slate-500 font-medium">${expText} | Stok: <span class="font-black text-amber-600">${b.stok}</span></span></div>`;
    }).join('');
    
    document.getElementById('alertPencegatanListMobile').innerHTML = listHTML;
    document.getElementById('btnAlertPencegatanLanjutMobile').onclick = function() {
        document.getElementById('modalAlertPencegatanMobile').classList.add('hidden');
        tutupModalMobile('modalTambahObatMobile');
        if(batches.length > 0) setTimeout(() => { bukaModalEditMobile(batches[0].idBatch); }, 400);
    };
    
    document.getElementById('modalAlertPencegatanMobile').classList.remove('hidden');
    setTimeout(() => { document.getElementById('panelAlertPencegatanMobile').classList.remove('scale-90', 'opacity-0'); document.getElementById('panelAlertPencegatanMobile').classList.add('scale-100', 'opacity-100'); }, 10);
}

function tutupKameraScannerMobile() {
    if(html5QrcodeScannerMobile) { html5QrcodeScannerMobile.stop().then(() => { document.getElementById('modalScannerKamera').classList.add('hidden'); }).catch(e => console.log(e)); } 
    else { document.getElementById('modalScannerKamera').classList.add('hidden'); }
}

let isSenterAktif = false;
function toggleSenterMobile() {
    if (html5QrcodeScannerMobile) {
        isSenterAktif = !isSenterAktif;
        html5QrcodeScannerMobile.applyVideoConstraints({
            advanced: [{ torch: isSenterAktif }]
        }).then(() => {
            let btn = document.getElementById('btnSenterMobile');
            if(isSenterAktif) {
                btn.innerHTML = '<i class="fa-solid fa-lightbulb text-emerald-400"></i> Matikan Senter';
                btn.classList.replace('bg-slate-800', 'bg-slate-700');
            } else {
                btn.innerHTML = '<i class="fa-solid fa-lightbulb text-amber-400"></i> Nyalakan Senter';
                btn.classList.replace('bg-slate-700', 'bg-slate-800');
            }
        }).catch(err => {
            isSenterAktif = !isSenterAktif; // Kembalikan status jika ditolak
            alert("⚠️ Gagal menyalakan senter! Browser di HP Anda mungkin memblokir fitur akses Senter demi aturan privasi, atau fiturnya tidak didukung.");
        });
    } else {
        alert("⚠️ Kamera belum aktif.");
    }
}

// ==========================================
// 17. MESIN UI/UX (CUSTOM ALERT & CONFIRM)
// ==========================================
const ALERT_STYLES = {
    success: {
        icon: 'w-16 h-16 mx-auto rounded-full bg-emerald-100 border-2 border-emerald-200 text-emerald-500 flex items-center justify-center text-3xl mb-3 shadow-inner',
        html: '<i class="fa-solid fa-check-circle"></i>',
        title: 'font-black text-emerald-700 text-xl tracking-tight mb-2',
        text: 'Sukses!',
        btn: 'w-full bg-emerald-500 text-white font-bold py-3.5 rounded-2xl shadow-md transition-transform active:scale-95'
    },
    error: {
        icon: 'w-16 h-16 mx-auto rounded-full bg-red-100 border-2 border-red-200 text-red-500 flex items-center justify-center text-3xl mb-3 shadow-inner animate-pulse',
        html: '<i class="fa-solid fa-triangle-exclamation"></i>',
        title: 'font-black text-red-700 text-xl tracking-tight mb-2',
        text: 'Perhatian!',
        btn: 'w-full bg-red-500 text-white font-bold py-3.5 rounded-2xl shadow-md transition-transform active:scale-95'
    },
    info: {
        icon: 'w-16 h-16 mx-auto rounded-full bg-blue-100 border-2 border-blue-200 text-blue-500 flex items-center justify-center text-3xl mb-3 shadow-inner',
        html: '<i class="fa-solid fa-bell"></i>',
        title: 'font-black text-blue-700 text-xl tracking-tight mb-2',
        text: 'Informasi',
        btn: 'w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl shadow-md transition-transform active:scale-95'
    }
};

window.alert = function(pesan) {
    const modal = document.getElementById('modalAlertMobile'); const panel = document.getElementById('panelAlertMobile');
    const icon = document.getElementById('iconAlertMobile'); const judul = document.getElementById('judulAlertMobile');
    const btn = document.getElementById('btnAlertMobile'); const teks = document.getElementById('teksAlertMobile');
    let strPesan = String(pesan).toLowerCase();
    
    let type = 'info';
    if (strPesan.includes('berhasil') || strPesan.includes('sukses') || strPesan.includes('✅')) type = 'success';
    else if (strPesan.includes('gagal') || strPesan.includes('wajib') || strPesan.includes('peringatan') || strPesan.includes('⚠️')) type = 'error';

    let s = ALERT_STYLES[type];
    icon.className = s.icon; icon.innerHTML = s.html;
    judul.className = s.title; judul.innerText = s.text;
    btn.className = s.btn;
    
    teks.innerText = pesan; 
    modal.classList.remove('hidden'); 
    setTimeout(() => { modal.classList.remove('opacity-0'); panel.classList.remove('scale-90'); }, 10);
};

function tutupAlertMobile() {
    const modal = document.getElementById('modalAlertMobile'); const panel = document.getElementById('panelAlertMobile');
    modal.classList.add('opacity-0'); panel.classList.add('scale-90'); setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

let aksiConfirmCallback = null;
function tampilkanConfirmMobile(pesan, callbackYa) {
    aksiConfirmCallback = callbackYa; document.getElementById('teksConfirmMobile').innerText = pesan;
    const modal = document.getElementById('modalConfirmMobile'); const panel = document.getElementById('panelConfirmMobile');
    modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); panel.classList.remove('scale-90'); }, 10);
}

function tutupConfirmMobile() {
    const modal = document.getElementById('modalConfirmMobile'); const panel = document.getElementById('panelConfirmMobile');
    modal.classList.add('opacity-0'); panel.classList.add('scale-90'); setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

function eksekusiConfirmMobile() { tutupConfirmMobile(); if(aksiConfirmCallback) setTimeout(() => { aksiConfirmCallback(); }, 300); }

// ==========================================
// 18. PELUNASAN KASBON & TUTUP BUKU
// ==========================================
let idsPelunasanMultiMobile = null;

function bukaModalPelunasanMobile(idsJoined, nama, totalTagihan) {
    idsPelunasanMultiMobile = idsJoined;
    document.getElementById('pelunasanNamaMobile').textContent = nama;
    document.getElementById('pelunasanTotalMobile').textContent = rupiah(totalTagihan);
    bukaModalMobile('modalPelunasanMobile', 'panelPelunasanMobile');
}

function eksekusiPelunasanMobile(metodePilihan) {
    if(idsPelunasanMultiMobile) {
        let arrIds = idsPelunasanMultiMobile.split(',');
        let totalBayar = 0;
        let namaPelanggan = document.getElementById('pelunasanNamaMobile').textContent;
        let waPelanggan = '';
        
        // Loop utang yang dilunasi
        cashierHistory.forEach(t => {
            if (arrIds.includes(t.id.toString()) && !t.statusLunas) {
                t.statusLunas = true; 
                totalBayar += (t.total || 0);
                if(t.wa) waPelanggan = t.wa;
            }
        });

        if (totalBayar > 0) {
            const idPelunasanBaru = Date.now();
            const tglWaktu = new Date();
            
            // Mengikat Tali Pusar dari Utang Lama ke Struk Pelunasan Baru
            cashierHistory.forEach(t => {
                if (arrIds.includes(t.id.toString())) t.idTerkait = idPelunasanBaru;
            });

            // Cetak Struk Pelunasan Hijau di Riwayat
            const pelunasanBaru = {
                id: idPelunasanBaru, tanggal: getTanggalLokal(), waktu: tglWaktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                obat: `PELUNASAN GABUNGAN: ${namaPelanggan}`, kasir: 'Pemilik', item: arrIds.length, total: totalBayar, metode: metodePilihan, laba: 0, pelanggan: namaPelanggan, wa: waPelanggan, isPelunasan: true, idTerkait: idsPelunasanMultiMobile
            };
            
            siklusAktif.uangMasuk += totalBayar;
            cashierHistory.unshift(pelunasanBaru);
            
            kirimNotifikasiMobile('Pelunasan Diterima', `Pelunasan kasbon dari ${namaPelanggan} via ${metodePilihan}.`, 'lunas', totalBayar);

            saveApotekDB('apotek_cashierHistory', cashierHistory); 
            saveApotekDB('apotek_siklusAktif', siklusAktif);

            tutupModalMobile('modalPelunasanMobile'); renderPiutangMobile(); renderBerandaMobile(); renderRiwayatMobile();
            triggerHaptic([100, 50, 100]);
            alert(`✅ Pelunasan Sukses! ${arrIds.length} Nota ditutup dan omzet bertambah.`);
        }
    }
}

// [CELAH 3] KANVAS WA DINAMIS KHUSUS TAGIHAN GABUNGAN PIUTANG
function tagihWAMultiPiutang(nama) {
    let notaHutang = cashierHistory.filter(t => t.metode === 'Debt' && !t.statusLunas && (t.pelanggan || '').trim().toUpperCase() === nama);
    
    if (notaHutang.length === 0) return alert("⚠️ Tidak ada tunggakan aktif untuk pelanggan ini.");
    let waTujuan = notaHutang.find(t => t.wa)?.wa;
    if (!waTujuan) return alert("⚠️ Nomor WhatsApp pelanggan tidak ditemukan di sistem!");
    
    let totalTagihan = 0;
    let rincianLines = [];
    
    notaHutang.forEach(n => {
        totalTagihan += n.total;
        rincianLines.push(`Tgl: ${n.tanggal} (${rupiah(n.total)})`);
        if(n.detailKeranjang && n.detailKeranjang.length > 0) {
            n.detailKeranjang.forEach(k => {
                let teks = ` - ${k.nama} x${k.qty}`;
                if(teks.length > 35) teks = teks.substring(0, 32) + "...";
                rincianLines.push(teks);
            });
        } else {
            let teks = ` - ${n.obat}`;
            if(teks.length > 35) teks = teks.substring(0, 32) + "...";
            rincianLines.push(teks);
        }
    });

    // Kalkulasi Tinggi Kanvas Anti-Overflow
    let canvasHeight = 300 + (rincianLines.length * 20);
    
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); 
    canvas.width = 400; canvas.height = canvasHeight;
    
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center';
    ctx.font = '900 24px monospace'; ctx.fillText(profilApotek.nama.toUpperCase().substring(0,25), 200, 45);
    ctx.font = '600 14px monospace'; ctx.fillText((profilApotek.alamat || '').substring(0,40), 200, 70);
    ctx.font = '14px monospace'; ctx.fillText('====================================', 200, 95);
    ctx.font = '900 18px monospace'; ctx.fillText('REKAP TAGIHAN PIUTANG', 200, 125);
    ctx.font = '14px monospace'; ctx.fillText('====================================', 200, 145);
    
    ctx.textAlign = 'left'; let y = 180; ctx.font = '600 14px monospace';
    ctx.fillText(`Yth. : ${nama}`, 25, y); y += 25;
    ctx.fillText(`Total: ${notaHutang.length} Nota Belum Lunas`, 25, y); y += 30;
    
    ctx.textAlign = 'center'; ctx.fillText('------------------------------------', 200, y); y += 25;
    ctx.textAlign = 'left';
    
    rincianLines.forEach(line => {
        if(line.startsWith('Tgl:')) {
            ctx.font = '900 13px monospace'; ctx.fillStyle = '#1e293b'; y += 5;
        } else {
            ctx.font = '500 13px monospace'; ctx.fillStyle = '#475569';
        }
        ctx.fillText(line, 25, y); y += 20;
    });
    
    y += 10;
    ctx.textAlign = 'center'; ctx.fillStyle = '#0f172a';
    ctx.font = '14px monospace'; ctx.fillText('------------------------------------', 200, y); y += 35;
    
    ctx.textAlign = 'left'; ctx.font = '900 18px monospace'; ctx.fillText('GRAND TOTAL:', 25, y);
    ctx.textAlign = 'right'; ctx.fillStyle = '#dc2626'; ctx.fillText(`${rupiah(totalTagihan)}`, 375, y); y += 45;
    
    ctx.fillStyle = '#64748b'; ctx.textAlign = 'center'; ctx.font = 'italic 12px monospace';
    ctx.fillText('Struk digital ini adalah rincian sah', 200, y); y += 20; ctx.fillText('dari ' + profilApotek.nama, 200, y);
    
    let noWA = waTujuan.toString().replace(/\D/g, ''); if (noWA.startsWith('0')) { noWA = '62' + noWA.substring(1); } else if (noWA.startsWith('8')) { noWA = '62' + noWA; }
    const pesanTeks = `Halo Bapak/Ibu *${nama}*,\n\nKami dari *${profilApotek.nama}* menginformasikan rekap tagihan yang belum diselesaikan sebesar *${rupiah(totalTagihan)}*.\n*(Rincian barang terlampir pada gambar)*\n\nMohon kerjasamanya untuk pelunasan. Terima kasih banyak! 🙏`;
    
    canvas.toBlob(async (blob) => {
        const namaFile = `Rekap_Tagihan_${nama.replace(/\s+/g, '_')}.png`; const fileGambar = new File([blob], namaFile, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [fileGambar] })) {
            try { await navigator.share({ files: [fileGambar], title: 'Tagihan Apotek', text: pesanTeks }); } catch (err) { console.log(err); }
        } else {
            alert("✅ Gambar rekap tagihan akan diunduh. Silakan kirim gambar tersebut ke WhatsApp yang terbuka otomatis.");
            const linkDownload = document.createElement('a'); linkDownload.href = URL.createObjectURL(blob); linkDownload.download = namaFile; linkDownload.click();
            setTimeout(() => { window.open(`https://api.whatsapp.com/send?phone=${noWA}&text=${encodeURIComponent(pesanTeks)}`, '_blank'); }, 800);
        }
    }, 'image/png');
}

function eksekusiTutupBukuMobile() {
    tampilkanConfirmMobile("Apakah Anda yakin ingin Tutup Buku?\n\nMesin akan beradaptasi: Jika sedang untung, masuk Mode Likuidasi. Jika rugi, Sisa Hutang Finansial akan diteruskan dengan patokan Fisik Stok Terakhir.", function() {
        
        let targetHutangLama = (siklusAktif.hutangAwal !== undefined ? siklusAktif.hutangAwal : (siklusAktif.modalAwal || 0)) + (siklusAktif.modalTambahan || 0);
        let tercapai = siklusAktif.uangMasuk || 0;
        let sudahUntung = tercapai > targetHutangLama;
        let sisaHutang = targetHutangLama - tercapai;
        if (sisaHutang < 0) sisaHutang = 0;
        
        let asetGudangFase = 0; let qtyGudangFase = 0;
        masterItems.filter(i => i.nama !== '___SYSTEM_AUTH___' && i.kategori !== '⚠️ Barang Retur').forEach(b => { 
             asetGudangFase += (b.modal || 0) * (b.stok || 0); qtyGudangFase += (b.stok || 0); 
         });
        
        let asetEtalaseFase = 0; let qtyEtalaseFase = 0;
        etalaseItems.forEach(b => {
            let totalModalBatchIni = 0;
            if(b.antreanFIFO && b.antreanFIFO.length > 0) { b.antreanFIFO.forEach(f => { totalModalBatchIni += ((f.modal || 0) * (f.stok || 0)); }); } 
            else { let m = masterItems.find(x => x.dnaInduk === b.dnaInduk || x.nama === b.nama); totalModalBatchIni = (m ? (m.modal || 0) : 0) * (b.stok || 0); }
            asetEtalaseFase += totalModalBatchIni; qtyEtalaseFase += (b.stok || 0);
        });
        
        let totalAsetFisikSekarang = asetGudangFase + asetEtalaseFase;
        let totalQtyFisikSekarang = qtyGudangFase + qtyEtalaseFase;
        
        let snapshotStok = {};
        masterItems.forEach(m => {
            if (m.nama !== '___SYSTEM_AUTH___' && m.kategori !== '⚠️ Barang Retur') {
                snapshotStok[m.dnaInduk] = (snapshotStok[m.dnaInduk] || 0) + m.stok;
            }
        });
        etalaseItems.forEach(e => {
            snapshotStok[e.dnaInduk] = (snapshotStok[e.dnaInduk] || 0) + e.stok;
        });
        
        if (sudahUntung) {
            siklusAktif = { 
                modalAwal: totalAsetFisikSekarang, qtyAwal: totalQtyFisikSekarang, 
                modalTambahan: 0, qtyTambahan: 0, uangMasuk: 0, 
                tanggalStart: getTanggalLokal(),
                isLikuidasi: true, isLanjutanDefisit: false, hutangAwal: 0,
                waktuStart: Date.now(), snapshotStok: snapshotStok
            };
        } else {
            // Mode Hybrid: Teks atas ikuti aset fisik, Teks bawah ikuti hutang cash
            siklusAktif = { 
                modalAwal: totalAsetFisikSekarang, qtyAwal: totalQtyFisikSekarang, 
                modalTambahan: 0, qtyTambahan: 0, uangMasuk: 0, 
                tanggalStart: getTanggalLokal(),
                isLikuidasi: false, isLanjutanDefisit: true, hutangAwal: sisaHutang,
                waktuStart: Date.now(), snapshotStok: snapshotStok
            };
        }
        
        saveApotekDB('apotek_siklusAktif', siklusAktif);

        renderBerandaMobile(); 
        
        setTimeout(() => { 
             if(sudahUntung) { alert("✅ TUTUP BUKU BERHASIL!\nMode Likuidasi Aktif. Fokus habiskan sisa Persediaan."); } 
             else { alert("✅ TUTUP BUKU BERHASIL!\nMode Defisit Lanjutan. Target hutang kasir Anda ("+ rupiah(sisaHutang) +") diteruskan."); } 
         }, 500);
    });
}

// ==========================================
// 19. MESIN BLUETOOTH PRINTER (ESC/POS)
// ==========================================
let printerApotekTerhubung = null;

async function prosesCetakStrukMobile(idTransaksi, elemenTombol) {
    const trx = cashierHistory.find(t => t.id === idTransaksi);
    if(!trx) return alert("⚠️ Data transaksi tidak ditemukan!");
    
    const posTengah = (text) => { let str = text.substring(0, 32); let pad = Math.floor((32 - str.length) / 2); return " ".repeat(pad > 0 ? pad : 0) + str + " ".repeat(pad > 0 ? pad : 0) + "\n"; };
    
    let struk = "";
    struk += posTengah(profilApotek.nama.toUpperCase());
    struk += posTengah((profilApotek.alamat || '').substring(0,32)); 
    if(profilApotek.telepon) struk += posTengah("Telp: " + profilApotek.telepon);
    struk += "================================\n";
    struk += `Tgl   : ${trx.tanggal} ${trx.waktu}\n`;
    struk += `Kasir : ${trx.kasir}\n`;
    struk += "--------------------------------\n";
    struk += `${trx.obat}\n`;
    struk += `${trx.item} Item        Rp ${trx.total.toLocaleString('id-ID')}\n`;
    struk += "--------------------------------\n";
    struk += `TOTAL           : Rp ${trx.total.toLocaleString('id-ID')}\n`;
    struk += `PEMBAYARAN      : ${trx.metode.toUpperCase()}\n`;
    struk += "================================\n";
    struk += "  Terima Kasih & Semoga Sehat!  \n\n\n";
    
    const encoder = new TextEncoder(); let payloadAkhir = encoder.encode(struk);
    
    try {
        const teksAsli = elemenTombol.innerHTML; elemenTombol.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>...';
        
        if (!printerApotekTerhubung) {
            printerApotekTerhubung = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'] });
        }
        
        const server = await printerApotekTerhubung.gatt.connect(); const services = await server.getPrimaryServices();
        let writeCharacteristic = null;
        
        for (const service of services) {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) { if (char.properties.write || char.properties.writeWithoutResponse) { writeCharacteristic = char; break; } }
            if (writeCharacteristic) break;
        }
        
        if (!writeCharacteristic) throw new Error("Printer tidak mendukung cetak");
        
        const CHUNK_SIZE = 100; 
        for (let i = 0; i < payloadAkhir.length; i += CHUNK_SIZE) {
            let potonganData = payloadAkhir.slice(i, i + CHUNK_SIZE); await writeCharacteristic.writeValue(potonganData); await new Promise(resolve => setTimeout(resolve, 50)); 
        }
        
        elemenTombol.innerHTML = teksAsli; alert("✅ Cetak Berhasil! Struk dikeluarkan oleh printer.");
    } catch(error) {
        console.log("Error Printer:", error); printerApotekTerhubung = null; elemenTombol.innerHTML = '<i class="fa-solid fa-print"></i> Cetak';
        alert("⚠️ Gagal Mencetak! Pastikan Bluetooth HP menyala, lokasi diizinkan, dan Printer Thermal hidup.");
    }
}

// ==========================================
// 20. CLOUD SYNC & PENCARIAN
// ==========================================
let supabaseClient = null; 

async function sinkronKeAwanMobile() {
    if (!supabaseClient) return;
    const indikator = document.getElementById('indikatorCloudMobile'); const teks = document.getElementById('teksCloudMobile');
    
    if(indikator && teks) { indikator.classList.replace('bg-red-50', 'bg-emerald-50'); indikator.classList.replace('text-red-500', 'text-emerald-500'); indikator.classList.replace('border-red-100', 'border-emerald-100'); teks.innerText = 'SYNC'; }
    
    try {
        if (masterItems.length > 0) await supabaseClient.from('master_items').upsert(masterItems, { onConflict: 'nama' });
        if (etalaseItems.length > 0) await supabaseClient.from('etalase_items').upsert(etalaseItems, { onConflict: 'nama' });
        if (cashierHistory.length > 0) await supabaseClient.from('cashier_history').upsert(cashierHistory, { onConflict: 'id' });
    } catch (err) { console.log(err); }
    
    setTimeout(() => { if(indikator && teks) { indikator.classList.replace('bg-emerald-50', 'bg-red-50'); indikator.classList.replace('text-emerald-500', 'text-red-500'); indikator.classList.replace('border-emerald-100', 'border-red-100'); teks.innerText = 'Live'; } }, 1500);
}

// TUGAS QW-3: CEGAH MEMORY LEAK INTERVAL CLOUD
let cloudSyncInterval = setInterval(() => { 
    if (!supabaseClient) {
        clearInterval(cloudSyncInterval); // Matikan putaran interval 24 jam jika tidak ada koneksi/API Key
        return;
    }
    sinkronKeAwanMobile(); 
}, 10000);

document.getElementById('cariGudangMobile').addEventListener('input', (e) => { renderGudangMobile(e.target.value); });

// ==========================================
// 21. MESIN RESET TOTAL
// ==========================================
function resetSistemMobile() {
    tampilkanConfirmMobile("PERINGATAN BAHAYA!\n\nApakah Anda yakin ingin menghapus SEMUA DATA secara permanen? Gudang, Etalase, Riwayat, Laporan, dan Siklus Modal akan dikosongkan ke posisi 0.", function() {
        
        saveApotekDB('apotek_masterItems', []); 
        saveApotekDB('apotek_etalaseItems', []); 
        saveApotekDB('apotek_cashierHistory', []);
        saveApotekDB('apotek_siklusAktif', { modalAwal: 0, qtyAwal: 0, modalTambahan: 0, qtyTambahan: 0, uangMasuk: 0, tanggalStart: getTanggalLokal() });
        
        alert("✅ Sistem berhasil dibersihkan sampai ke akarnya! Memuat ulang..."); 
        setTimeout(() => { window.location.reload(); }, 1200); 
    }); 
}

// ==========================================
// 22. MESIN SIDEBAR & NOTIFIKASI CHAT
// ==========================================
function bukaSidebarKiriMobile() {
    const overlay = document.getElementById('sidebarKiriOverlay'); const panel = document.getElementById('sidebarKiriMobile');
    overlay.classList.remove('hidden'); setTimeout(() => { overlay.classList.remove('opacity-0'); panel.classList.remove('-translate-x-full'); }, 10);
}

function tutupSidebarKiriMobile() {
    const overlay = document.getElementById('sidebarKiriOverlay'); const panel = document.getElementById('sidebarKiriMobile');
    overlay.classList.add('opacity-0'); panel.classList.add('-translate-x-full'); setTimeout(() => { overlay.classList.add('hidden'); }, 300);
}

function bukaNotifikasiMobile() {
    const overlay = document.getElementById('sidebarKananOverlay'); const panel = document.getElementById('sidebarKananMobile');
    overlay.classList.remove('hidden'); setTimeout(() => { overlay.classList.remove('opacity-0'); panel.classList.remove('translate-x-full'); }, 10);
    
    // Hilangkan titik merah alarm
    if(document.getElementById('badgeNotifPing')) document.getElementById('badgeNotifPing').classList.add('hidden');
    if(document.getElementById('badgeNotifSolid')) document.getElementById('badgeNotifSolid').classList.add('hidden');
    renderListNotifikasiMobile();
}

function tutupNotifikasiMobile() {
    const overlay = document.getElementById('sidebarKananOverlay'); const panel = document.getElementById('sidebarKananMobile');
    overlay.classList.add('opacity-0'); panel.classList.add('translate-x-full'); setTimeout(() => { overlay.classList.add('hidden'); batalSeleksiNotif(); }, 300);
}

// Logika Multi-Seleksi Hapus Notifikasi
let modeSeleksiNotifAktif = false;
let itemTerpilihNotif = [];
let timerLongPressNotif;

function mulaiTekanNotif(id) { if(modeSeleksiNotifAktif) return; timerLongPressNotif = setTimeout(() => { triggerHaptic(100); aktifkanModeSeleksiNotif(id); }, 500); }
function lepasTekanNotif() { clearTimeout(timerLongPressNotif); }
function klikItemNotif(id) { if(modeSeleksiNotifAktif) { togglePilihNotif(id); } }

function aktifkanModeSeleksiNotif(idPertama) {
    modeSeleksiNotifAktif = true; itemTerpilihNotif = [idPertama];
    document.getElementById('headerNormalNotif').classList.add('hidden'); document.getElementById('headerNormalNotif').classList.remove('flex');
    document.getElementById('headerSeleksiNotif').classList.remove('hidden'); document.getElementById('headerSeleksiNotif').classList.add('flex');
    renderListNotifikasiMobile();
}

function batalSeleksiNotif() {
    modeSeleksiNotifAktif = false; itemTerpilihNotif = [];
    document.getElementById('headerSeleksiNotif').classList.add('hidden'); document.getElementById('headerSeleksiNotif').classList.remove('flex');
    document.getElementById('headerNormalNotif').classList.remove('hidden'); document.getElementById('headerNormalNotif').classList.add('flex');
    renderListNotifikasiMobile();
}

function togglePilihNotif(id) {
    let idx = itemTerpilihNotif.indexOf(id);
    if(idx !== -1) itemTerpilihNotif.splice(idx, 1); else itemTerpilihNotif.push(id);
    if(itemTerpilihNotif.length === 0) batalSeleksiNotif(); else { document.getElementById('teksJumlahSeleksiNotif').textContent = itemTerpilihNotif.length + " Dipilih"; renderListNotifikasiMobile(); }
}

function pilihSemuaNotif() {
    itemTerpilihNotif = notifikasiHistori.map(n => n.id);
    document.getElementById('teksJumlahSeleksiNotif').textContent = itemTerpilihNotif.length + " Dipilih"; renderListNotifikasiMobile();
}

function prosesHapusMasalNotif() {
    if(itemTerpilihNotif.length === 0) return;
    tampilkanConfirmMobile("Hapus " + itemTerpilihNotif.length + " notifikasi yang dipilih?", function() {
        notifikasiHistori = notifikasiHistori.filter(n => !itemTerpilihNotif.includes(n.id));
        saveApotekDB('apotek_notifikasi', notifikasiHistori);
        batalSeleksiNotif(); triggerHaptic([100, 50, 100]);
    });
}

function kirimNotifikasiMobile(judul, pesan, tipe, nilaiUang) {
    const waktu = new Date(); const strWaktu = waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    notifikasiHistori.unshift({ id: Date.now(), judul, pesan, tipe, uang: nilaiUang, waktu: strWaktu, tanggal: getTanggalLokal() });
    if(notifikasiHistori.length > 30) notifikasiHistori.pop(); // Batas maksimal 30 chat
    
    saveApotekDB('apotek_notifikasi', notifikasiHistori);
    
    // Nyalakan titik merah
    if(document.getElementById('badgeNotifPing')) document.getElementById('badgeNotifPing').classList.remove('hidden');
    if(document.getElementById('badgeNotifSolid')) document.getElementById('badgeNotifSolid').classList.remove('hidden');
    triggerHaptic([50, 100, 50]);
}

function renderListNotifikasiMobile() {
    const wadah = document.getElementById('wadahListNotifikasiMobile');
    if(notifikasiHistori.length === 0) {
        wadah.innerHTML = `<div class="text-center mt-10 opacity-40"><i class="fa-regular fa-bell-slash text-5xl mb-3 block"></i><p class="text-xs font-black uppercase tracking-widest">Belum Ada Notifikasi</p></div>`;
        return;
    }
    
    if(modeSeleksiNotifAktif) {
        document.getElementById('teksJumlahSeleksiNotif').textContent = itemTerpilihNotif.length + " Dipilih";
    }

    wadah.innerHTML = notifikasiHistori.map(n => {
        let warnaTema = '', icon = '';
        if(n.tipe === 'beli') { warnaTema = 'emerald'; icon = 'fa-solid fa-cash-register'; }
        else if(n.tipe === 'piutang') { warnaTema = 'red'; icon = 'fa-solid fa-book-open'; }
        else if(n.tipe === 'lunas') { warnaTema = 'blue'; icon = 'fa-solid fa-handshake'; }
        else if(n.tipe === 'batal') { warnaTema = 'amber'; icon = 'fa-solid fa-rotate-left'; }
        
        let isSelected = itemTerpilihNotif.includes(n.id);
        let bgCard = isSelected ? 'bg-red-50 border-red-300 shadow-md transform scale-[0.98]' : 'bg-white border-slate-200 shadow-sm';
        
        return `
        <div class="flex flex-col gap-1 w-full">
            <span class="text-[9px] font-bold text-slate-400 text-center mb-1 drop-shadow-sm">${n.tanggal === getTanggalLokal() ? 'Hari Ini' : n.tanggal}, ${n.waktu}</span>
            <div class="flex items-start gap-2">
                <div class="w-8 h-8 rounded-full bg-${warnaTema}-100 text-${warnaTema}-600 flex items-center justify-center shrink-0 border border-${warnaTema}-200 shadow-sm mt-1 z-10"><i class="${icon} text-[11px]"></i></div>
                <div onpointerdown="mulaiTekanNotif(${n.id})" onpointerup="lepasTekanNotif()" onpointerleave="lepasTekanNotif()" onclick="klikItemNotif(${n.id})" class="${bgCard} select-none cursor-pointer rounded-2xl rounded-tl-none p-3 flex-1 relative overflow-hidden transition-all group">
                    <div class="absolute top-0 right-0 w-10 h-10 bg-${warnaTema}-50 rounded-bl-full -z-0 opacity-50 pointer-events-none"></div>
                    <div class="relative z-10 pointer-events-none">
                        <h4 class="font-black text-${warnaTema}-700 text-xs mb-0.5 leading-tight">${n.judul}</h4>
                        <p class="text-[10px] text-slate-600 font-medium leading-relaxed">${n.pesan}</p>
                        <p class="text-xs font-black text-slate-800 mt-1.5 border-t border-slate-100 pt-1 border-dashed">${rupiah(n.uang)}</p>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

// Override Fungsi Setelan Profil Untuk Mengubah Nama di Sidebar
const fungsiLamaSimpanSetelan = prosesSimpanSetelanMobile;
prosesSimpanSetelanMobile = function() {
    let namaBaru = document.getElementById('setNamaMobile').value;
    fungsiLamaSimpanSetelan();
    if(document.getElementById('namaApotekSidebar')) document.getElementById('namaApotekSidebar').innerText = namaBaru;
}

// ==========================================
// 23. INISIALISASI SAAT APLIKASI DIBUKA
// ==========================================
window.onload = () => { 
    try { 
        let p = JSON.parse(localStorage.getItem('apotek_profilData')); 
        if(p) { 
            profilApotek = p; 
            document.getElementById('namaApotekHeader').innerText = p.nama; 
            if(document.getElementById('namaApotekSidebar')) document.getElementById('namaApotekSidebar').innerText = p.nama; 
            document.getElementById('setNamaMobile').value = p.nama; 
        } 
    } catch(e) {}
    renderBerandaMobile(); 
};

// ==========================================
// 24. MESIN DETAIL TIGA SERANGKAI STOK (POPUP & RINCIAN)
// ==========================================
function tutupModalRingkasanMobile() {
    const modal = document.getElementById('modalRingkasanStokMobile');
    const panel = document.getElementById('panelRingkasanStokMobile');
    modal.classList.add('opacity-0'); panel.classList.add('scale-90');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

function bukaDetailTigaSerangkai(jenis) {
    let totalGudang = 0, totalEtalase = 0;
    let terjualTunai = 0, terjualQRIS = 0, terjualKasbon = 0;
    
    // Mesin Hitung Sisa
    masterItems.forEach(m => { if(m.nama !== '___SYSTEM_AUTH___' && m.kategori !== '⚠️ Barang Retur') totalGudang += m.stok; });
    etalaseItems.forEach(e => { totalEtalase += e.stok; });
    
    // Mesin Hitung Terjual
    let waktuMulai = siklusAktif.waktuStart || 0;
    cashierHistory.filter(t => (waktuMulai ? t.id >= waktuMulai : t.tanggal >= siklusAktif.tanggalStart) && !t.isPelunasan).forEach(trx => {
        let qty = 0;
        if(trx.detailKeranjang) { trx.detailKeranjang.forEach(i => qty += i.qty); } else { qty = trx.item || 1; }
        if(trx.metode === 'Tunai') terjualTunai += qty;
        else if(trx.metode === 'QRIS') terjualQRIS += qty;
        else if(trx.metode === 'Debt') terjualKasbon += qty;
    });
    
    let sisaTotal = totalGudang + totalEtalase;
    let terjualTotal = terjualTunai + terjualQRIS + terjualKasbon;
    let absolutTotal = siklusAktif.waktuStart ? (siklusAktif.qtyTambahan || 0) : (sisaTotal + terjualTotal);
    
    // --- LOMPATAN LOGIKA UNTUK TOTAL MODAL STOK ---
    if (jenis === 'total') {
        tampilkanConfirmMobile(`Modal Stok pembukuan Baru sebanyak ${absolutTotal} stok.\n\nCek rincian di Master Gudang?`, function() {
            bukaLayar('gudang');
        });
        return; // Hentikan fungsi di sini agar pop-up tengah tidak muncul
    }

    const icon = document.getElementById('iconRingkasanStok');
    const judul = document.getElementById('judulRingkasanStok');
    const subJudul = document.getElementById('subJudulRingkasanStok');
    const rincianArea = document.getElementById('areaRincianRingkasan');
    const totalAngka = document.getElementById('angkaRingkasanTotal');
    const btnLanjut = document.getElementById('btnLanjutRincianStok');

    // Desain Pop-up Tengah Dinamis (Pcs diganti Stok)
    if (jenis === 'sisa') {
        icon.innerHTML = '<i class="fa-solid fa-boxes-stacked"></i>';
        icon.className = 'h-16 w-16 rounded-full bg-blue-50 border-4 border-white shadow-sm flex items-center justify-center mb-3 relative z-10 text-blue-500 text-2xl';
        judul.textContent = "Sisa Stok (Tersedia)"; subJudul.textContent = "Gudang & Etalase";
        
        rincianArea.innerHTML = `
            <div class="flex justify-between items-center mb-3"><span class="text-xs font-bold text-slate-500 flex items-center gap-2"><i class="fa-solid fa-box text-slate-400 w-4 text-center"></i> Stok Gudang</span><span class="text-sm font-black text-slate-700">${totalGudang} Stok</span></div>
            <div class="flex justify-between items-center mb-2"><span class="text-xs font-bold text-slate-500 flex items-center gap-2"><i class="fa-solid fa-store text-slate-400 w-4 text-center"></i> Stok Etalase</span><span class="text-sm font-black text-slate-700">${totalEtalase} Stok</span></div>
        `;
        totalAngka.textContent = sisaTotal; totalAngka.className = "text-3xl font-black text-blue-600 tracking-tighter drop-shadow-sm";
    } else if (jenis === 'terjual') {
        icon.innerHTML = '<i class="fa-solid fa-cart-arrow-down"></i>';
        icon.className = 'h-16 w-16 rounded-full bg-amber-50 border-4 border-white shadow-sm flex items-center justify-center mb-3 relative z-10 text-amber-500 text-2xl';
        judul.textContent = "Stok Terjual"; subJudul.textContent = "Berdasarkan Pembayaran";
        
        rincianArea.innerHTML = `
            <div class="flex justify-between items-center mb-2"><span class="text-xs font-bold text-slate-500 flex items-center gap-2"><i class="fa-solid fa-money-bill-wave text-emerald-400 w-4 text-center"></i> Tunai</span><span class="text-sm font-black text-slate-700">${terjualTunai} Stok</span></div>
            <div class="flex justify-between items-center mb-2"><span class="text-xs font-bold text-slate-500 flex items-center gap-2"><i class="fa-solid fa-qrcode text-blue-400 w-4 text-center"></i> QRIS</span><span class="text-sm font-black text-slate-700">${terjualQRIS} Stok</span></div>
            <div class="flex justify-between items-center mb-2"><span class="text-xs font-bold text-slate-500 flex items-center gap-2"><i class="fa-solid fa-book-open text-red-400 w-4 text-center"></i> Kasbon</span><span class="text-sm font-black text-slate-700">${terjualKasbon} Stok</span></div>
        `;
        totalAngka.textContent = terjualTotal; totalAngka.className = "text-3xl font-black text-amber-500 tracking-tighter drop-shadow-sm";
    }

    // Sambungkan tombol Lanjut
    btnLanjut.setAttribute('onclick', `lanjutBukaDaftarRincian('${jenis}')`);
    
    // Tampilkan Modal Popup Tengah
    const modal = document.getElementById('modalRingkasanStokMobile');
    const panel = document.getElementById('panelRingkasanStokMobile');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); panel.classList.remove('scale-90'); }, 10);
}

// Transisi Halus dari Pop-up ke Layar Bawah
function lanjutBukaDaftarRincian(jenis) {
    tutupModalRingkasanMobile();
    setTimeout(() => {
        prosesRenderDetailTigaSerangkai(jenis);
    }, 250);
}

// Ini adalah proses Render Layar Bawah (Gambar 2)
function prosesRenderDetailTigaSerangkai(jenis) {
    const wadah = document.getElementById('wadahListDetailStok');
    const judul = document.getElementById('judulDetailStok');
    const subJudul = document.getElementById('subJudulDetailStok');
    
    let totalQty = 0; let totalNominal = 0; let htmlContent = '';
    
    const buatKotakTipis = (nama, modal, jual, qty, warnaPita = 'bg-slate-300') => `
        <div class="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between shadow-sm relative overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 ${warnaPita}"></div>
            <div class="pl-2 flex-1">
                <h4 class="text-xs font-black text-slate-800 leading-tight truncate pr-2">${nama}</h4>
                <div class="text-[9px] font-bold text-slate-500 mt-1 flex gap-2">
                    <span>Beli: <span class="text-red-500">${rupiah(modal)}</span></span>
                    <span>Jual: <span class="text-emerald-600">${rupiah(jual)}</span></span>
                </div>
            </div>
            <div class="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 text-center shrink-0">
                <span class="block text-sm font-black text-corporate-700 leading-none">${qty}</span>
            </div>
        </div>`;
        
    const buatSubJudul = (teks, icon, warna) => `
        <div class="flex items-center gap-2 mt-4 mb-1.5 pl-1">
            <div class="w-5 h-5 rounded-md ${warna} flex items-center justify-center text-[10px]"><i class="${icon}"></i></div>
            <span class="text-[10px] font-black text-slate-600 uppercase tracking-widest">${teks}</span>
        </div>`;

    if (jenis === 'sisa') {
        judul.textContent = "Sisa Stok (Tersedia)"; subJudul.textContent = "Gudang & Etalase";
        let gabungan = {};
        
        masterItems.forEach(m => { if(m.nama !== '___SYSTEM_AUTH___' && m.kategori !== '⚠️ Barang Retur') {
            if(!gabungan[m.nama]) gabungan[m.nama] = { nama: m.nama, modal: m.modal, jual: m.jual, qty: 0 };
            gabungan[m.nama].qty += m.stok;
        }});
        etalaseItems.forEach(e => {
            if(!gabungan[e.nama]) gabungan[e.nama] = { nama: e.nama, modal: (e.antreanFIFO && e.antreanFIFO[0]?.modal) || 0, jual: e.jual, qty: 0 };
            gabungan[e.nama].qty += e.stok;
        });
        
        Object.values(gabungan).forEach(item => {
            if(item.qty > 0) {
                totalQty += item.qty; totalNominal += (item.qty * item.jual);
                htmlContent += buatKotakTipis(item.nama, item.modal, item.jual, item.qty, 'bg-blue-400');
            }
        });
        
    } else if (jenis === 'terjual') {
        judul.textContent = "Stok Terjual"; subJudul.textContent = "Dikelompokkan Berdasarkan Pembayaran";
        
        let jualTunai = {}, jualQRIS = {}, jualKasbon = {};
        let waktuMulai = siklusAktif.waktuStart || 0;
        
        cashierHistory.filter(t => (waktuMulai ? t.id >= waktuMulai : t.tanggal >= siklusAktif.tanggalStart) && !t.isPelunasan).forEach(trx => {
            let targetGroup = trx.metode === 'Tunai' ? jualTunai : (trx.metode === 'QRIS' ? jualQRIS : jualKasbon);
            
            if(trx.detailKeranjang) {
                trx.detailKeranjang.forEach(item => {
                    if(!targetGroup[item.nama]) targetGroup[item.nama] = { nama: item.nama, modal: item.hppSatuan || (item.jual*0.8), jual: item.jual, qty: 0 };
                    targetGroup[item.nama].qty += item.qty;
                });
            } else {
                if(!targetGroup[trx.obat]) targetGroup[trx.obat] = { nama: trx.obat, modal: ((trx.total||0)-(trx.laba||0))/(trx.item||1), jual: (trx.total||0)/(trx.item||1), qty: 0 };
                targetGroup[trx.obat].qty += (trx.item||1);
            }
        });
        
        const prosesGrup = (grupData, pitaClass) => {
            let html = '';
            Object.values(grupData).forEach(item => {
                totalQty += item.qty; totalNominal += (item.qty * item.jual);
                html += buatKotakTipis(item.nama, item.modal, item.jual, item.qty, pitaClass);
            });
            return html;
        };
        
        let htmlTunai = prosesGrup(jualTunai, 'bg-emerald-400');
        if(htmlTunai) htmlContent += buatSubJudul('Pembayaran Tunai', 'fa-solid fa-money-bill', 'bg-emerald-100 text-emerald-600') + htmlTunai;
        
        let htmlQRIS = prosesGrup(jualQRIS, 'bg-blue-400');
        if(htmlQRIS) htmlContent += buatSubJudul('Pembayaran Digital (QRIS)', 'fa-solid fa-qrcode', 'bg-blue-100 text-blue-600') + htmlQRIS;
        
        let htmlKasbon = prosesGrup(jualKasbon, 'bg-red-400');
        if(htmlKasbon) htmlContent += buatSubJudul('Tunggakan (Kasbon)', 'fa-solid fa-book-open', 'bg-red-100 text-red-600') + htmlKasbon;
        
    } else if (jenis === 'total') {
        judul.textContent = "Total Keseluruhan Stok"; subJudul.textContent = "Sisa Tersedia + Terjual";
        htmlContent = `<div class="p-6 text-center text-slate-500 mt-10"><i class="fa-solid fa-layer-group text-4xl mb-3 text-slate-300"></i><p class="text-xs font-bold leading-relaxed">Daftar Lengkap di Panel Spesifik<br><br>Silakan buka panel Sisa atau Terjual secara terpisah untuk melihat rincian daftarnya secara spesifik.</p></div>`;
        totalQty = parseInt(document.getElementById('panelStokTotal').textContent);
        totalNominal = 0; 
    }
    
    if(!htmlContent && jenis !== 'total') htmlContent = `<div class="p-6 text-center text-slate-400 mt-4 text-xs font-bold">Data kosong.</div>`;
    
    document.getElementById('rekapQtyDetailStok').textContent = totalQty + " Pcs";
    document.getElementById('rekapNominalDetailStok').textContent = jenis === 'total' ? "-" : rupiah(totalNominal);
    wadah.innerHTML = htmlContent;
    bukaModalMobile('modalDetailStokMobile', 'panelDetailStokMobile');
}

// ==========================================
// MESIN EXPORT LAPORAN KE MICROSOFT WORD (A4 LANDSCAPE)
// ==========================================
function exportLaporanKeWord() {
    let tglFilter = document.getElementById('filterTglLaporanMobile')?.value || getTanggalLokal();
    let dataPeriode = cashierHistory.filter(t => t.tanggal === tglFilter);
    
    if(dataPeriode.length === 0) return alert("Data kosong! Belum ada transaksi pada tanggal ini.");

    // Variabel Rekapitulasi
    let lOmzet = 0, lLaba = 0, lHPP = 0;
    let inTunai = 0, inQRIS = 0, inLunas = 0, outKasbon = 0;
    let htmlTabel = ""; let urut = 1;
    
    // Perulangan Data Transaksi
    dataPeriode.forEach(t => {
        let hpp = 0, omzet = 0, laba = 0;
        let qty = t.item, namaObat = t.obat;

        if(!t.isPelunasan) {
            omzet = t.total; laba = t.laba; hpp = (t.total - t.laba);
            lOmzet += omzet; lLaba += laba; lHPP += hpp;
            if(t.metode === "Tunai") inTunai += omzet;
            if(t.metode === "QRIS") inQRIS += omzet;
            if(t.metode === "Debt" || t.metode === "Kasbon") outKasbon += omzet;
        } else {
            qty = "-"; namaObat = "PELUNASAN KASBON (" + (t.pelanggan || 'Pelanggan') + ")";
            omzet = t.total; inLunas += omzet;
            if(t.metode === "Tunai") inTunai += omzet;
            if(t.metode === "QRIS") inQRIS += omzet;
        }

        // Baris Tabel (Garis hitam murni untuk Word)
        htmlTabel += `
            <tr>
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${urut++}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${t.waktu}</td>
                <td style="border: 1px solid #000; padding: 6px;">${namaObat}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${qty}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${t.metode}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${hpp > 0 ? rupiah(hpp) : '-'}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${rupiah(omzet)}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${laba > 0 ? rupiah(laba) : '-'}</td>
            </tr>
        `;
    });

    let totalOmzetSemua = lOmzet + inLunas;
    let totalPemasukanFisik = inTunai + inQRIS;

    // --- 1. HEADER & XML KHUSUS WORD (Set A4 Landscape) ---
    let header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>";
    header += "<head><meta charset='utf-8'><title>Laporan Apotek</title>";
    header += `
    <style>
        /* Perintah Wajib Word untuk Landscape A4 */
        @page WordSection1 {
            size: 841.95pt 595.35pt; 
            mso-page-orientation: landscape;
            margin: 1cm 1cm 1cm 1cm;
        }
        div.WordSection1 { page: WordSection1; font-family: 'Arial', sans-serif; font-size: 11pt; }
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #0f766e; color: white; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; }
        td { border: 1px solid #000; padding: 5px; }
        .title { text-align: center; font-size: 18pt; font-weight: bold; color: #0f766e; margin-bottom: 5px; }
        .subtitle { text-align: center; font-size: 11pt; margin-bottom: 25px; color: #444; }
        .info-table { border: none; margin-bottom: 15px; width: 100%; }
        .info-table td { border: none; padding: 4px; }
    </style>
    </head><body><div class='WordSection1'>
    `;

    // --- 2. ISI KONTEN (Tabel dan Teks) ---
    let content = `
    <div class="title">${profilApotek.nama.toUpperCase()}</div>
    <div class="subtitle">Laporan Harian Operasional & Keuangan<br>Alamat: ${profilApotek.alamat || '-'}</div>

    <table class="info-table">
        <tr>
            <td width="15%"><b>Tanggal</b></td><td width="35%">: ${tglFilter}</td>
            <td width="15%"><b>Shift</b></td><td width="35%">: Full Day</td>
        </tr>
        <tr>
            <td><b>Kasir</b></td><td>: Sistem Kasir</td>
            <td><b>Total Trx</b></td><td>: ${urut - 1} Nota</td>
        </tr>
    </table>

    <h3 style="color: #0f766e; margin-bottom: 10px;">A. Rincian Penjualan Transaksi Harian</h3>
    <table>
        <thead>
            <tr>
                <th width="5%">No</th><th width="10%">Jam</th><th width="28%">Nama Obat / Keterangan</th>
                <th width="7%">Qty</th><th width="12%">Metode</th><th width="12%">Modal (HPP)</th>
                <th width="13%">Omzet</th><th width="13%">Laba Bersih</th>
            </tr>
        </thead>
        <tbody>
            ${htmlTabel}
        </tbody>
        <tfoot>
            <tr>
                <td colspan="5" style="text-align: right; font-weight: bold; border: 1px solid #000; padding: 8px;">TOTAL TRANSAKSI KESELURUHAN</td>
                <td style="text-align: right; font-weight: bold; border: 1px solid #000;">${rupiah(lHPP)}</td>
                <td style="text-align: right; font-weight: bold; border: 1px solid #000;">${rupiah(totalOmzetSemua)}</td>
                <td style="text-align: right; font-weight: bold; border: 1px solid #000;">${rupiah(lLaba)}</td>
            </tr>
        </tfoot>
    </table>

    <br>
    <h3 style="color: #0f766e; margin-bottom: 10px;">B. Arus Kas Kasir & Rekap Laci</h3>
    <table style="width: 60%; margin-left: 0;">
        <tr><td width="60%" style="border: none;">Tunai (Cash)</td><td style="border: none; text-align: right;">${rupiah(inTunai)}</td></tr>
        <tr><td style="border: none;">Digital (QRIS)</td><td style="border: none; text-align: right;">${rupiah(inQRIS)}</td></tr>
        <tr><td style="border: none;">Pelunasan Utang</td><td style="border: none; text-align: right;">${rupiah(inLunas)}</td></tr>
        <tr><td style="border-top: 1px solid #000; border-bottom: none; border-left: none; border-right: none; font-weight:bold;">Total Pemasukan Murni</td><td style="border-top: 1px solid #000; border-bottom: none; border-left: none; border-right: none; text-align: right; font-weight:bold; color: green;">${rupiah(totalPemasukanFisik)}</td></tr>
        <tr><td style="border: none;"><br><b>Uang Fisik (Laci Tunai)</b></td><td style="border: none; text-align: right;"><br><b>${rupiah(inTunai)}</b></td></tr>
        <tr><td style="border: none; color: red;">Kasbon / Utang Baru</td><td style="border: none; text-align: right; color: red;">${rupiah(outKasbon)}</td></tr>
    </table>

    <br><br><br>
    <table style="width: 100%; text-align: center; border: none; margin-top: 30px;">
        <tr>
            <td style="border: none; width: 50%;">Dibuat Oleh,<br><br><br><br><br>( Kasir / Shift )</td>
            <td style="border: none; width: 50%;">Diperiksa Oleh,<br><br><br><br><br>( ${profilApotek.nama} )</td>
        </tr>
    </table>
    `;

    let footer = "</div></body></html>";
    let fullHTML = header + content + footer;

    // --- 3. PROSES UNDUH FILE .DOC ---
    let blob = new Blob(['\ufeff', fullHTML], { type: 'application/msword' });
    let url = URL.createObjectURL(blob);
    let link = document.createElement("a");
    link.href = url;
    link.download = "Laporan_Apotek_" + tglFilter + ".doc";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert("✅ File Laporan Word berhasil diunduh ke HP Anda!");
}

// ==========================================
// MESIN CETAK LAPORAN KE PDF (MENGGUNAKAN TEMPLATE BAWAAN HTML)
// ==========================================
function exportLaporanKePDF() {
    let tglFilter = document.getElementById('filterTglLaporanMobile')?.value || getTanggalLokal();
    let dataPeriode = cashierHistory.filter(t => t.tanggal === tglFilter);
    
    if(dataPeriode.length === 0) return alert("Data kosong! Belum ada transaksi pada tanggal ini.");

    // Variabel Rekapitulasi
    let lOmzet = 0, lLaba = 0, lHPP = 0;
    let inTunai = 0, inQRIS = 0, inLunas = 0, outKasbon = 0;
    let urut = 1;
    let isiTabelHTML = "";
    
    // Perulangan Data Transaksi
    dataPeriode.forEach(t => {
        let hpp = 0, omzet = 0, laba = 0;
        let qty = t.item, namaObat = t.obat;

        if(!t.isPelunasan) {
            omzet = t.total; laba = t.laba; hpp = (t.total - t.laba);
            lOmzet += omzet; lLaba += laba; lHPP += hpp;
            if(t.metode === "Tunai") inTunai += omzet;
            if(t.metode === "QRIS") inQRIS += omzet;
            if(t.metode === "Debt" || t.metode === "Kasbon") outKasbon += omzet;
        } else {
            qty = "-"; namaObat = "PELUNASAN KASBON (" + (t.pelanggan || 'Pelanggan') + ")";
            omzet = t.total; inLunas += omzet;
            if(t.metode === "Tunai") inTunai += omzet;
            if(t.metode === "QRIS") inQRIS += omzet;
        }

        // Rancang baris tabel untuk elemen `p-tabel-body`
        isiTabelHTML += `
            <tr>
                <td class="text-center">${urut++}</td>
                <td class="text-center">${t.waktu}</td>
                <td>${namaObat}</td>
                <td class="text-center">${qty}</td>
                <td class="text-center">${t.metode}</td>
                <td class="text-right">${hpp > 0 ? rupiah(hpp) : '-'}</td>
                <td class="text-right">${rupiah(omzet)}</td>
                <td class="text-right">${laba > 0 ? rupiah(laba) : '-'}</td>
            </tr>
        `;
    });

    let totalOmzetSemua = lOmzet + inLunas;
    let totalPemasukanFisik = inTunai + inQRIS;

    // --- SUNTIK DATA KE TEMPLATE CETAK HTML (DOM INJECTION) ---
    // Header Info
    document.getElementById('p-nama-apotek').innerText = profilApotek.nama.toUpperCase();
    document.getElementById('p-owner').innerText = profilApotek.nama;
    document.getElementById('p-tgl').innerText = tglFilter;
    document.getElementById('p-trx').innerText = (urut - 1) + " Nota";

    // A. Tabel Transaksi
    document.getElementById('p-tabel-body').innerHTML = isiTabelHTML;
    document.getElementById('p-tot-hpp').innerText = rupiah(lHPP);
    document.getElementById('p-tot-omzet').innerText = rupiah(totalOmzetSemua);
    document.getElementById('p-tot-laba').innerText = rupiah(lLaba);

    // B. Arus Kas
    document.getElementById('p-in-tunai').innerText = inTunai.toLocaleString('id-ID');
    document.getElementById('p-in-qris').innerText = inQRIS.toLocaleString('id-ID');
    document.getElementById('p-in-lunas').innerText = inLunas.toLocaleString('id-ID');
    document.getElementById('p-in-total').innerText = totalPemasukanFisik.toLocaleString('id-ID');
    document.getElementById('p-out-kasbon').innerText = outKasbon.toLocaleString('id-ID');

    // C. Rekap Laci
    document.getElementById('p-laci-tunai').innerText = inTunai.toLocaleString('id-ID');
    document.getElementById('p-laci-total').innerText = inTunai.toLocaleString('id-ID');

    // Memicu perintah Print Bawaan Browser
    setTimeout(() => {
        window.print();
    }, 300);
}