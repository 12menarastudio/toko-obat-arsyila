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
let profilApotek = { nama: "TOKO OBAT ARSYILA", alamat: "Desa Bahari Dua, Buton Selatan", telepon: "081234567890" };

// Variabel Global Baru untuk Keranjang Cicilan Piutang (Pembelah Sel)
let seleksiPiutangEceran = [];
let siklusAktif = { modalAwal: 0, qtyAwal: 0, modalTambahan: 0, qtyTambahan: 0, uangMasuk: 0, tanggalStart: getTanggalLokal() };
let notifikasiHistori = []; // DATABASE NOTIFIKASI TAMBAHAN
let pengeluaranHistory = []; // MESIN BARU: DATABASE KAS KELUAR & BIAYA
let antreanKulakan = []; // PENAMPUNGAN FAKTUR KULAKAN SEMENTARA
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

// MESIN ROLLING BALANCE (SALDO BERJALAN UANG FISIK LACI)
function hitungSaldoLaciFisik() {
    let lTunai = 0, lPelunasanTunai = 0, totalKeluar = 0;
    // Kalkulasi MURNI semua riwayat tunai tanpa filter "hari ini"
    cashierHistory.forEach(t => {
        if (!t.isPelunasan && t.metode === 'Tunai') { lTunai += (t.total || 0); }
        else if (t.isPelunasan && (t.metodeBayar === 'Tunai' || t.metode === 'Tunai')) { lPelunasanTunai += (t.total || 0); }
    });
    pengeluaranHistory.forEach(p => { totalKeluar += (p.nominal || 0); });
    return (lTunai + lPelunasanTunai) - totalKeluar;
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
    
    let parsedPengeluaran = JSON.parse(localStorage.getItem('apotek_pengeluaranHistory'));
    if (Array.isArray(parsedPengeluaran)) pengeluaranHistory = parsedPengeluaran;
let parsedAntrean = JSON.parse(localStorage.getItem('apotek_antreanKulakan'));
    if (Array.isArray(parsedAntrean)) antreanKulakan = parsedAntrean;
    if (!siklusAktif.tanggalStart) siklusAktif.tanggalStart = getTanggalLokal();
} catch(e) { console.error("Gagal memuat memori", e); }

// [MODIFIKASI TAHAP 1] - SENSOR IMUNITAS (MIGRASI DATA KE kulakan)
// Mengubah data tunggal menjadi bersarang (Nested) secara otomatis tanpa merusak aplikasi
masterItems.forEach(obat => {
    if (!obat.kulakan_keuangan) {
        obat.kulakan_keuangan = [
            {
                idkulakan: "F-MIGRASI-" + obat.idBatch,
                tanggalNota: "Data Sistem Lama",
                hpp: obat.modal || 0,
                stokAwal: obat.stok || 0,
                sisaGudang: obat.stok || 0,
                sisaEtalase: 0,
                modalKeluar: obat.totalModal !== undefined ? obat.totalModal : ((obat.modal || 0) * (obat.stok || 0))
            }
        ];
    }
});

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
    let waktuMulai = siklusAktif.waktuStart || 0; // KUNCI SHIFT: Membaca jam Tutup Buku terakhir
    
    let omzet = 0, laba = 0, hpp = 0, daftarTerlaris = {}, totalKasbonBelumLunas = 0;
    let totalItemTerjualHariIni = 0, totalPembeliHariIni = 0; 
    let totalPelunasan = 0; 
    
    cashierHistory.forEach(t => {
        // MENGHITUNG OMZET BERDASARKAN SHIFT AKTIF (Setelah Tutup Buku Terakhir)
        if (t.id >= waktuMulai) {
            if (!t.isPelunasan) {
                omzet += t.total || 0; laba += t.laba || 0; hpp += ((t.total || 0) - (t.laba || 0));
                totalItemTerjualHariIni += (t.item || 0); 
                totalPembeliHariIni++; 
                
                if (daftarTerlaris[t.obat]) { 
                     daftarTerlaris[t.obat].item += t.item || 0; 
                     daftarTerlaris[t.obat].omset += t.total || 0; 
                 } else { 
                     daftarTerlaris[t.obat] = { nama: t.obat, item: t.item || 0, omset: t.total || 0 }; 
                 }
            } else {
                totalPelunasan += t.total || 0; 
            }
        }
        
        // PANTAUAN GLOBAL (Tetap menghitung hutang orang dari masa lalu)
        if (t.metode === 'Debt' && !t.statusLunas) totalKasbonBelumLunas++;
    });
    
    document.getElementById('berandaOmzet').textContent = rupiah(Math.round(omzet));
    document.getElementById('berandaHPP').textContent = '- ' + rupiah(Math.round(hpp));
    document.getElementById('berandaLaba').textContent = rupiah(Math.round(laba));
    
    if(document.getElementById('berandaPelunasan')) {
        document.getElementById('berandaPelunasan').textContent = '+ ' + rupiah(totalPelunasan);
        document.getElementById('wadahPelunasan').classList.toggle('hidden', totalPelunasan === 0);
    }

    let asetGudang = 0, totalJenisObat = 0, countKritis = 0, countExpired = 0, stokGabungan = {};
    let totalSisaStok = 0; 
    
    masterItems.forEach(b => {
        if (b.nama !== '___SYSTEM_AUTH___') {
            asetGudang += (b.totalModal !== undefined ? b.totalModal : (b.modal * b.stok)); 
            if (!stokGabungan[b.dnaInduk]) { stokGabungan[b.dnaInduk] = 0; totalJenisObat++; }
            stokGabungan[b.dnaInduk] += b.stok;
            totalSisaStok += b.stok; 
            
            if (b.expired) {
                let diffHari = Math.floor((new Date(b.expired) - new Date(tglHariIni)) / (1000 * 60 * 60 * 24));
                if (diffHari <= 30 && diffHari >= 0) countExpired++;
            }
        }
    });
    Object.values(stokGabungan).forEach(totalStok => { if (totalStok <= 2) countKritis++; });
    
    let asetEtalase = 0;
    etalaseItems.forEach(b => {
        if (!stokGabungan[b.dnaInduk]) { stokGabungan[b.dnaInduk] = 0; totalJenisObat++; }
        stokGabungan[b.dnaInduk] += (b.stok || 0);
        totalSisaStok += (b.stok || 0); 
        
        if(b.antreanFIFO && b.antreanFIFO.length > 0) {
            b.antreanFIFO.forEach(fifo => { 
                asetEtalase += (fifo.totalModal !== undefined ? fifo.totalModal : (fifo.modal * fifo.stok)); 
            });
        } else {
            let masterNya = masterItems.find(m => m.dnaInduk === b.dnaInduk || m.nama === b.nama); 
            asetEtalase += (masterNya ? (masterNya.modal || 0) : 0) * (b.stok || 0);
        }
    });

    let asetGudangkulakan = 0; let stokGudangkulakan = 0;
    masterItems.forEach(i => { 
        if (i.nama !== '___SYSTEM_AUTH___' && i.kategori !== '⚠️ Barang Retur') { 
            asetGudangkulakan += (i.totalModal !== undefined ? i.totalModal : (i.modal * i.stok)); 
            stokGudangkulakan += (i.stok || 0); 
        } 
    });
    
    let asetEtalasekulakan = 0; let stokEtalasekulakan = 0;
    etalaseItems.forEach(i => {
        if(i.antreanFIFO && i.antreanFIFO.length > 0) {
            i.antreanFIFO.forEach(fifo => { 
                asetEtalasekulakan += (fifo.totalModal !== undefined ? fifo.totalModal : (fifo.modal * fifo.stok)); 
            });
        } else {
            let masterNya = masterItems.find(m => m.dnaInduk === i.dnaInduk || m.nama === i.nama); 
            let hpp = masterNya ? (masterNya.modal || 0) : 0;
            asetEtalasekulakan += (hpp * (i.stok || 0)); 
        }
        stokEtalasekulakan += (i.stok || 0);
    });

    let totalAsetFisik = asetGudangkulakan + asetEtalasekulakan;
    let totalStokFisik = stokGudangkulakan + stokEtalasekulakan;
    
    let topModalMurni = (siklusAktif.modalAwal || 0) + (siklusAktif.modalTambahan || 0);
    let topQtyMurni = (siklusAktif.qtyAwal || 0) + (siklusAktif.qtyTambahan || 0);
    let tercapai = siklusAktif.uangMasuk || 0;
    let targetHutang = (siklusAktif.hutangAwal !== undefined ? siklusAktif.hutangAwal : (siklusAktif.modalAwal || 0)) + (siklusAktif.modalTambahan || 0);
    
    let labelBawah = document.getElementById('berandaStatusSiklus');
    let progressBar = document.getElementById('berandaProgressSiklus');

    if (siklusAktif.isLikuidasi) {
        if (document.getElementById('berandaTotalStokMasuk')) document.getElementById('berandaTotalStokMasuk').textContent = totalStokFisik + " Stok Persediaan";
        document.getElementById('berandaAset').textContent = rupiah(totalAsetFisik);
        let patokanAwal = siklusAktif.modalAwal || 1; 
        let persenLikuidasi = 100 - ((totalAsetFisik / patokanAwal) * 100);
        if (persenLikuidasi < 0) persenLikuidasi = 0; if (totalAsetFisik <= 0) persenLikuidasi = 100;
        if (labelBawah) labelBawah.innerHTML = `Persediaan Awal: <span class="text-emerald-500 font-black">${rupiah(totalAsetFisik)}</span>`;
        if (progressBar) { progressBar.className = "h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000"; progressBar.style.width = persenLikuidasi + "%"; }
    } else {
        let teksAtasLabel = siklusAktif.isLanjutanDefisit ? "Stok Terakhir" : "Stok Dibeli";
        if (document.getElementById('berandaTotalStokMasuk')) document.getElementById('berandaTotalStokMasuk').textContent = topQtyMurni + " " + teksAtasLabel;
        document.getElementById('berandaAset').textContent = rupiah(topModalMurni);
        
        if (targetHutang === 0 && tercapai === 0) {
            if (labelBawah) labelBawah.innerHTML = `Sisa Target Balik Modal: <span class="text-red-500 font-black">Rp 0</span>`;
            if (progressBar) { progressBar.className = "h-full bg-gradient-to-r from-red-500 to-amber-400 rounded-full transition-all duration-1000"; progressBar.style.width = "0%"; }
        } else if (tercapai < targetHutang) {
            let sisaHutang = targetHutang - tercapai; 
            let persen = topModalMurni === 0 ? 0 : Math.max(0, ((topModalMurni - sisaHutang) / topModalMurni) * 100);
            if (labelBawah) labelBawah.innerHTML = `Sisa Target Balik Modal: <span class="text-red-500 font-black">${rupiah(sisaHutang)}</span>`;
            if (progressBar) { progressBar.className = "h-full bg-gradient-to-r from-red-500 to-amber-400 rounded-full transition-all duration-1000"; progressBar.style.width = persen + "%"; }
        } else if (tercapai === targetHutang && targetHutang > 0) {
            if (labelBawah) labelBawah.innerHTML = `<div class="bg-amber-500 text-white px-3 py-1 rounded-lg font-black shadow-sm text-[10px] tracking-widest uppercase flex items-center justify-center gap-1.5 w-full"><i class="fa-solid fa-scale-balanced text-sm"></i> STATUS KEMBALI MODAL</div>`;
            if (progressBar) { progressBar.className = "h-full bg-amber-400 rounded-full transition-all duration-1000"; progressBar.style.width = "100%"; }
        } else {
            let untung = tercapai - targetHutang;
            if (labelBawah) labelBawah.innerHTML = `<div class="bg-emerald-600 text-white px-3 py-1 rounded-lg font-black shadow-sm text-[10px] tracking-widest uppercase flex items-center justify-center gap-1.5 w-full"><i class="fa-solid fa-circle-check text-sm"></i> ANDA TELAH UNTUNG: ${rupiah(untung)}</div>`;
            if (progressBar) { progressBar.className = "h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000"; progressBar.style.width = "100%"; }
        }
    }

    let arrTerlaris = Object.values(daftarTerlaris).sort((a, b) => b.item - a.item).slice(0, 3);
    const wadahTerlaris = document.getElementById('wadahObatTerlaris');
    
    if(arrTerlaris.length === 0) {
        wadahTerlaris.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs font-bold"><i class="fa-solid fa-box-open text-3xl mb-2 block opacity-50"></i><br>Belum ada penjualan di sesi ini</div>`;
    } else {
        wadahTerlaris.innerHTML = arrTerlaris.map((ob, idx) => {
            let styling = idx === 0 ? 'bg-amber-100 text-amber-600 border-amber-200' : (idx === 1 ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-orange-50 text-orange-600 border-orange-200');
            return `<div class="flex items-center gap-3 p-3 hover:bg-slate-50 transition"><div class="w-8 h-8 rounded-full ${styling} flex items-center justify-center font-black text-sm shrink-0 border">${idx + 1}</div><div class="flex-1 overflow-hidden"><h4 class="font-bold text-slate-800 text-sm truncate">${ob.nama}</h4><p class="text-[10px] text-slate-500 mt-0.5">${ob.item} Terjual</p></div><div class="text-right shrink-0"><p class="font-bold text-corporate-700 text-sm">${rupiah(ob.omset)}</p></div></div>`;
        }).join('');
    }
    
    document.getElementById('berandaKritis').textContent = countKritis;
    document.getElementById('berandaKasbon').textContent = totalKasbonBelumLunas;
    document.getElementById('berandaKedaluwarsa').textContent = countExpired;
    
    if (document.getElementById('berandaSisaStok')) document.getElementById('berandaSisaStok').textContent = totalSisaStok;
    if (document.getElementById('berandaObatTerjual')) document.getElementById('berandaObatTerjual').textContent = totalItemTerjualHariIni;
    if (document.getElementById('berandaPembeli')) document.getElementById('berandaPembeli').textContent = totalPembeliHariIni;
    if (document.getElementById('berandaJenis')) document.getElementById('berandaJenis').textContent = totalJenisObat;
    
    let terjualSiklusIni = 0;
    cashierHistory.forEach(t => {
        if (t.id >= waktuMulai && !t.isPelunasan) {
            terjualSiklusIni += (t.item || 0);
        }
    });
    
    if (document.getElementById('panelStokSisa')) document.getElementById('panelStokSisa').textContent = totalSisaStok;
    if (document.getElementById('panelStokTerjual')) document.getElementById('panelStokTerjual').textContent = terjualSiklusIni;
    
    let angkaStokModal = 0;
    if (siklusAktif.isLikuidasi) {
        angkaStokModal = siklusAktif.qtyTambahan || 0;
    } else {
        angkaStokModal = (siklusAktif.qtyAwal || 0) + (siklusAktif.qtyTambahan || 0);
    }
    if (document.getElementById('panelStokTotal')) document.getElementById('panelStokTotal').textContent = angkaStokModal;
    
    const scrollPantauan = document.getElementById('wadahPantauanSistem');
    if (scrollPantauan) { scrollPantauan.scrollLeft = 0; }
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
            trx.detailKeranjang.forEach(item => { 
                let kunci = item.dnaInduk || item.nama;
                terjualGlobal[kunci] = (terjualGlobal[kunci] || 0) + item.qty; 
            });
        } else {
            terjualGlobal[trx.obat] = (terjualGlobal[trx.obat] || 0) + (trx.item || 1);
        }
    });
    
    let stokEtalaseGlobal = {};
    etalaseItems.forEach(e => { 
        let kunci = e.dnaInduk || e.nama;
        stokEtalaseGlobal[kunci] = (stokEtalaseGlobal[kunci] || 0) + e.stok; 
    });

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
        let qtyTerjual = terjualGlobal[g.dnaInduk] || terjualGlobal[g.nama] || 0;
        let qtyEtalase = stokEtalaseGlobal[g.dnaInduk] || stokEtalaseGlobal[g.nama] || 0;
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
                <div class="flex items-center gap-2 mt-1.5">
                    <span class="text-[9px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-bold uppercase tracking-widest border border-slate-200">${g.kategori || 'Tanpa Kategori'}</span>
                    <button onclick="bukaDetailObatMobile('${g.dnaInduk}')" class="text-[9px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-bold uppercase tracking-widest border border-blue-200 active:scale-95 transition shadow-sm"><i class="fa-solid fa-circle-info"></i> Cek Detail</button>
                </div>
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
                <div class="flex-1 text-center">
                    <p class="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><i class="fa-solid fa-check-circle"></i> Sisa Stok</p>
                    <p class="text-sm font-black text-emerald-600 leading-none drop-shadow-sm">${sisaFisik}</p>
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
    
    let etalaseAktif = etalaseItems.filter(i => i.stok > 0 && (i.nama.toLowerCase().includes(f) || (i.kategori && i.kategori.toLowerCase().includes(f)) || (i.varian && i.varian.toLowerCase().includes(f))));

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
function prosesHapusMasalRiwayat() {
    if(itemTerpilihRiwayat.length === 0) return;

    // 1. MESIN PEMILAH ABSOLUT: Hanya 2 Jalur (Hangus & Kebal)
    let idHangus = [];
    let idDilindungi = [];

    itemTerpilihRiwayat.forEach(idTarget => {
        let trx = cashierHistory.find(t => t.id === idTarget);
        if (!trx) return;

        // ATURAN BESI BARU: Semua jenis Piutang (Debt) & Laporan Pelunasan DITOLAK MUTLAK
        if (trx.metode === 'Debt' || trx.isPelunasan) {
            idDilindungi.push(idTarget);
        } 
        // HANYA Transaksi Normal (Tunai/QRIS) yang BOLEH DIHAPUS PERMANEN
        else {
            idHangus.push(idTarget);
        }
    });

    // 2. CEK BLOKIR TOTAL
    if (idHangus.length === 0) {
        return alert(`🛡️ AKSES DITOLAK!\n\nSeluruh ${itemTerpilihRiwayat.length} transaksi yang dipilih adalah data Kasbon/Pelunasan. Sistem melindunginya secara mutlak agar Buku Piutang tidak rusak.`);
    }

    // 3. PESAN KONFIRMASI CERDAS
    let pesanConfirm = `Hapus permanen ${idHangus.length} riwayat transaksi normal terpilih?\n\n(Total Uang di Brankas & Laporan Tutup Buku tetap aman).`;
    
    if (idDilindungi.length > 0) {
        pesanConfirm = `Dari ${itemTerpilihRiwayat.length} transaksi, ada ${idDilindungi.length} item Piutang/Pelunasan yang 🛡️ DILINDUNGI.\n\nLanjutkan menghapus sisa ${idHangus.length} transaksi normal?`;
    }

    tampilkanConfirmMobile(pesanConfirm, function() {
        
        // 4. EKSEKUSI PEMUSNAHAN MURNI HANYA UNTUK TRANSAKSI NORMAL
        cashierHistory = cashierHistory.filter(t => !idHangus.includes(t.id));

        saveApotekDB('apotek_cashierHistory', cashierHistory);

        batalSeleksiRiwayat();
        renderBerandaMobile();
        if(!document.getElementById('layar-piutang').classList.contains('hidden')) renderPiutangMobile();

        triggerHaptic([100,50,100]);

        // 5. LAPORAN HASIL AKHIR
        let pesanSukses = `✅ ${idHangus.length} Riwayat normal berhasil dihapus permanen.`;
        if (idDilindungi.length > 0) {
            pesanSukses += `\n🛡️ ${idDilindungi.length} riwayat DITOLAK penghapusannya demi menjaga rantai Piutang.`;
        }
        alert(pesanSukses);
    });
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
    }

    
        // [PENYEMPURNAAN 2] ILUSI VISUAL GROUPING BERDASAR WAKTU & NAMA
    let grupRiwayat = {};
    dataTampil.forEach(t => {
        // Jangan render kuitansi anak borongan, biar riwayat tetap bersih
        if (t.isBorongan) return; 
        
        let key = t.isPelunasan ? `PELUNASAN_${t.id}` : `${t.waktu}_${t.pelanggan || 'UMUM'}_${t.metode}`;
                                if (!grupRiwayat[key]) {
                grupRiwayat[key] = {
                    idGabungan: t.id, waktu: t.waktu, metode: t.metode, pelanggan: t.pelanggan, kasir: t.kasir,
                    isPelunasan: t.isPelunasan, isBintang: t.isBintang, statusLunas: t.statusLunas,
                    total: 0, item: 0, rincian: [], rawIds: [], metodeBayar: t.metodeBayar
                };
            }

        grupRiwayat[key].total += (t.total || 0);
        grupRiwayat[key].item += (t.item || 1);
        grupRiwayat[key].rawIds.push(t.id);
        
        if (t.isPelunasan) {
            grupRiwayat[key].obat = t.obat; 
        } else if(t.detailKeranjang && t.detailKeranjang.length > 0) {
            t.detailKeranjang.forEach(k => {
                let nLengkap = k.nama;
                if(k.varian) nLengkap += ` ${k.varian}`;
                if(k.kategori) nLengkap += ` • ${k.kategori}`;
                
                // MINTA ASISTEN CEK BUKU CATATAN
                let historiCicilan = cashierHistory.filter(p => p.isPelunasan && p.idTerkait == t.id && !p.isIndukBorongan && p.obat.includes(k.nama.replace(/ \([^)]*\)/, '')));
                let qtyTertebus = historiCicilan.reduce((sum, p) => sum + (p.item || 0), 0);
                let nominalTertebus = historiCicilan.reduce((sum, p) => sum + (p.total || 0), 0);
                
                let qtySisa = k.qty - qtyTertebus;
                
                if (t.statusLunas || qtySisa <= 0) {
                    // LUNAS TOTAL (Garis Coret)
                    let nominalItem = (k.jual * k.qty).toLocaleString('id-ID');
                    grupRiwayat[key].rincian.push(`
                    <div class="flex flex-col w-full mb-2">
                        <div class="flex items-start w-full opacity-60">
                            <div class="text-[10px] text-slate-600 font-semibold leading-tight flex-1 line-through">- ${nLengkap} (x${k.qty})</div>
                            <div class="w-[75px] shrink-0 flex justify-between text-[11px] font-black text-slate-800 pl-1 line-through">
                                <span>Rp</span><span>${nominalItem}</span>
                            </div>
                        </div>
                        <div class="text-[9px] font-bold text-emerald-600 mt-0.5 ml-2 flex items-center gap-1">
                            <i class="fa-solid fa-check-circle"></i> Lunas Total: Rp ${nominalItem}
                        </div>
                    </div>`);
                } else if (qtyTertebus > 0) {
                    // LUNAS SEBAGIAN (Animasi Kuning Amber)
                    let nominalSisaStr = ((t.total || k.jual * k.qty) - nominalTertebus).toLocaleString('id-ID');
                    let nominalTebusStr = nominalTertebus.toLocaleString('id-ID');
                    grupRiwayat[key].rincian.push(`
                    <div class="flex flex-col w-full mb-2 bg-amber-50/30 p-2 rounded-xl border border-amber-200">
                        <div class="flex items-start w-full">
                            <div class="text-[10.5px] text-slate-800 font-bold leading-tight flex-1">- ${nLengkap} (x${qtySisa})</div>
                            <div class="w-[75px] shrink-0 flex justify-between text-[11px] font-black text-slate-800 pl-1">
                                <span>Rp</span><span>${nominalSisaStr}</span>
                            </div>
                        </div>
                        <div class="text-[9px] font-bold text-amber-600 mt-1.5 ml-2 flex items-center gap-1">
                            <i class="fa-solid fa-clock"></i> Telah ditebus ${qtyTertebus} stok: Rp ${nominalTebusStr}
                        </div>
                    </div>`);
                } else {
                    // NORMAL / BELUM DISENTUH
                    let nominalItem = (k.jual * k.qty).toLocaleString('id-ID');
                    grupRiwayat[key].rincian.push(`
                    <div class="flex items-start w-full mb-1.5">
                        <div class="text-[10px] text-slate-600 font-semibold leading-tight flex-1">- ${nLengkap} (x${k.qty})</div>
                        <div class="w-[75px] shrink-0 flex justify-between text-[11px] font-black text-slate-800 pl-1">
                            <span>Rp</span><span>${nominalItem}</span>
                        </div>
                    </div>`);
                }
            });
        } else {
            let nominalTotal = (t.total).toLocaleString('id-ID');
            grupRiwayat[key].rincian.push(`<div class="flex items-start w-full mb-1.5"><div class="text-[10px] text-slate-600 font-semibold leading-tight flex-1">- ${t.obat} (x${t.item || 1})</div><div class="w-[75px] shrink-0 flex justify-between text-[11px] font-black text-slate-800 pl-1"><span>Rp</span><span>${nominalTotal}</span></div></div>`);
        }
    });

        wadah.innerHTML = Object.values(grupRiwayat).map(g => {
        let badgeWarna = g.metode === 'Tunai' ? 'bg-emerald-100 text-emerald-700' : (g.metode === 'QRIS' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700');
        let teksStatus = g.metode; let isSelected = g.rawIds.some(id => itemTerpilihRiwayat.includes(id));
        let bgCard = isSelected ? 'bg-blue-50 border-blue-400 shadow-md transform scale-[0.98]' : 'bg-white border-slate-200 shadow-sm';
        
        if(g.metode === 'Debt') {
            // [LOGIKA BARU] Cek Silang: Pastikan SEMUA item di dalam kotak ini benar-benar lunas
            let semuaLunas = g.rawIds.every(id => {
                let itemAsli = cashierHistory.find(x => x.id === id);
                return itemAsli ? itemAsli.statusLunas : true;
            });

            if(semuaLunas) {
                teksStatus = 'Lunas / Ditutup'; badgeWarna = 'bg-emerald-100 text-emerald-700';
            } else {
                let historiGrup = cashierHistory.filter(p => p.isPelunasan && p.idTerkait && g.rawIds.includes(parseInt(p.idTerkait)) && !p.isIndukBorongan);
                if(historiGrup.length > 0) {
                    teksStatus = 'Lunas Sebagian';
                    badgeWarna = 'bg-amber-100 text-amber-700';
                    if(!isSelected) bgCard = 'bg-white border-amber-300 shadow-sm border-2'; 
                }
            }
        }

        if(g.isPelunasan) teksStatus = 'Uang Masuk (Kasbon)';
        
        let starIcon = g.isBintang ? `<i class="fa-solid fa-star text-amber-400 text-xs drop-shadow-sm ml-1.5 align-middle -mt-0.5"></i>` : '';
        let judulObat = g.isPelunasan ? g.obat : `<i class="fa-solid fa-box-open mr-1 text-slate-400"></i> ${g.rincian.length} Item (${g.item} Stok)`;
        let teksKonsumen = (g.pelanggan && g.pelanggan !== 'UMUM' && !g.isPelunasan) ? `<p class="text-[10px] text-corporate-600 font-black mt-0.5 uppercase">Konsumen: ${g.pelanggan}</p>` : '';
        
        let areaRincian = '';
        if (!g.isPelunasan && g.rincian.length > 0) {
            areaRincian = `<div class="mt-3 mb-2 pt-2 border-t border-dashed border-slate-200"><p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Rincian Faktur:</p><div class="w-full">${g.rincian.join('')}</div></div>`;
        }

        let tombolPortal = (g.metode === 'Debt' && g.pelanggan) ? `<button onclick="event.stopPropagation(); lompatKeBukuPiutang('${g.pelanggan}')" class="mt-2 text-[9px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1.5 w-max active:scale-95"><i class="fa-solid fa-book-open"></i> Lihat Buku Piutang</button>` : '';

        // [PERISAI LOGIKA] Sembunyikan tombol batal jika utang (Debt) sudah dicicil atau lunas
        let isUtangTercicil = g.metode === 'Debt' && cashierHistory.some(p => p.isPelunasan && p.idTerkait && g.rawIds.includes(parseInt(p.idTerkait)));
        let isUtangLunas = g.metode === 'Debt' && g.rawIds.every(id => { let k = cashierHistory.find(x => x.id === id); return k ? k.statusLunas : true; });
        
                        // --- INJEKSI UI PELUNASAN ELEGAN ---
        let badgePelunasanHtml = '';
        if (g.isPelunasan) {
            let pName = (g.pelanggan && g.pelanggan !== 'UMUM') ? g.pelanggan : 'TIDAK DIKETAHUI';
            let qtyTebus = g.item || 1;
            let metode = (g.metodeBayar || 'TUNAI').toUpperCase();
            
            // Logika Ikon & Warna Dinamis
            let iconMetode = metode === 'QRIS' ? '<i class="fa-solid fa-qrcode"></i>' : '<i class="fa-solid fa-money-bill-wave"></i>';
            let warnaMetode = metode === 'QRIS' ? 'bg-blue-50/80 text-blue-700 border-blue-200/60' : 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60';
            
            badgePelunasanHtml = `
            <div class="flex items-center flex-wrap gap-1.5 mt-2.5 z-10">
                <span class="bg-slate-50 text-slate-600 px-2 py-0.5 rounded text-[9.5px] font-bold border border-slate-200 uppercase tracking-widest shadow-sm">👤 ${pName}</span>
                <span class="bg-slate-50 text-slate-600 px-2 py-0.5 rounded text-[9.5px] font-bold border border-slate-200 uppercase tracking-widest shadow-sm">📦 x${qtyTebus} STOK</span>
                <span class="${warnaMetode} px-2 py-0.5 rounded text-[9.5px] font-bold border uppercase tracking-widest shadow-sm">${iconMetode} ${metode}</span>
            </div>`;
        }
        // -----------------------------------


        let btnBatalHtml = (isUtangTercicil || isUtangLunas) ? '' : `<button onclick="event.stopPropagation(); prosesBatalTransaksiMobile(${g.rawIds[0]})" class="text-[10px] text-red-500 hover:bg-red-50 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-red-100 shadow-sm active:scale-95"><i class="fa-solid fa-rotate-left"></i> Batal</button>`;

        let tombolAksi = modeSeleksiRiwayatAktif ? '' : `
            <div class="flex gap-2 relative z-10 mt-3 justify-end border-t border-slate-100 pt-3">
                ${btnBatalHtml}
                <button onclick="event.stopPropagation(); prosesCetakStrukMobile(${g.rawIds[0]}, this)" class="text-[10px] text-blue-600 hover:bg-blue-50 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-blue-100 shadow-sm active:scale-95"><i class="fa-solid fa-print"></i> Cetak</button>
            </div>`;
            
                       return `<div id="kartu-riwayat-${g.waktu.replace(/[:\.]/g,'')}-${g.pelanggan ? g.pelanggan.toUpperCase().replace(/\s/g,'') : 'UMUM'}" onpointerdown="mulaiTekanRiwayat(${g.rawIds[0]})" onpointerup="lepasTekanRiwayat()" onpointerleave="lepasTekanRiwayat()" onclick="klikItemRiwayat(${g.rawIds[0]})" class="${bgCard} select-none rounded-2xl p-4 flex flex-col transition-all cursor-pointer relative group"><div class="flex justify-between items-start pointer-events-none"><div class="pr-2 flex-1"><p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1"><i class="fa-regular fa-calendar-days"></i> ${g.tanggal || tglFilter} • ${g.waktu}</p><h3 class="font-bold text-slate-800 text-sm leading-tight inline-block mb-1">${judulObat} ${starIcon}</h3><p class="text-[10px] text-slate-500 font-medium">Oleh: ${g.kasir}</p>${badgePelunasanHtml}${teksKonsumen}</div><div class="text-right shrink-0"><p class="font-black ${isSelected ? 'text-blue-700' : 'text-corporate-700'} text-base">${rupiah(g.total)}</p><span class="inline-block mt-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${badgeWarna}">${teksStatus}</span></div></div>${areaRincian}${tombolPortal}${tombolAksi}</div>`;
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
    const dataDebtMentah = cashierHistory.filter(t => t.metode === 'Debt' || t.isPelunasan);
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
            agregasiPelanggan[namaNormal].riwayatLunas.push(t);
        } else if (!t.statusLunas) {
            // [LOGIKA ASISTEN] Hitung sisa tagihan dari riwayat kuitansi tanpa merusak data asli
            let historiCicilan = cashierHistory.filter(p => p.isPelunasan && p.idTerkait == t.id && !p.isIndukBorongan);
            let nominalTertebus = historiCicilan.reduce((sum, p) => sum + (p.total || 0), 0);
            let sisaTagihan = (t.total || 0) - nominalTertebus;

            if (sisaTagihan > 0) {
                agregasiPelanggan[namaNormal].totalAktif += sisaTagihan;
                agregasiPelanggan[namaNormal].idsAktif.push(t.id);
                totalPiutang += sisaTagihan;
                
                let keyWaktu = t.tanggal + '_' + t.waktu;
                if(!agregasiPelanggan[namaNormal].tunggakanAktif[keyWaktu]) {
                    agregasiPelanggan[namaNormal].tunggakanAktif[keyWaktu] = {
                        tanggal: t.tanggal, waktu: t.waktu, totalWaktuIni: 0, items: []
                    };
                }
                agregasiPelanggan[namaNormal].tunggakanAktif[keyWaktu].totalWaktuIni += sisaTagihan;
                
                // Kita tanamkan sisa tagihan ke object agar gampang digambar nanti
                let itemCopy = JSON.parse(JSON.stringify(t));
                itemCopy.sisaTagihan = sisaTagihan;
                
                let qtyTertebus = historiCicilan.reduce((sum, p) => sum + (p.item || 0), 0);
                itemCopy.qtySisa = (t.item || 1) - qtyTertebus;
                
                agregasiPelanggan[namaNormal].tunggakanAktif[keyWaktu].items.push(itemCopy);
            }
        }
    });

    document.getElementById('headerTotalPiutangMobile').textContent = rupiah(totalPiutang);

    let listTampil = Object.values(agregasiPelanggan)
        .filter(p => (p.totalAktif > 0 || p.riwayatLunas.length > 0) && (filterTeks === '' || p.nama.toLowerCase().includes(filterTeks)));

    if(listTampil.length === 0) {
        if (filterTeks === '') {
            wadah.innerHTML = `<div class="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm mt-4"><i class="fa-solid fa-face-smile-beam text-5xl text-emerald-400 mb-3 block"></i><p class="font-bold text-slate-600">Bagus Sekali!</p><p class="text-xs text-slate-500 mt-1">Tidak ada pelanggan yang menunggak.</p></div>`;
        } else {
            wadah.innerHTML = `<div class="text-center p-6 text-slate-400 text-xs font-bold">Pencarian tidak ditemukan.</div>`;
        }
        return;
    }

    wadah.innerHTML = listTampil.map(p => {
        let zonaMerahHtml = Object.values(p.tunggakanAktif).map(grup => {
            let isMultiDalamSatuWaktu = grup.items.length > 1; 
            
            let itemLines = grup.items.map(itemDb => {
                let namaLengkap = itemDb.obat;
                if (itemDb.detailKeranjang && itemDb.detailKeranjang.length > 0) {
                    let k = itemDb.detailKeranjang[0];
                    namaLengkap = k.nama;
                    if(k.varian) namaLengkap += ` ${k.varian}`;
                    if(k.kategori) namaLengkap += ` • ${k.kategori}`;
                }
                
                                let namaObatParam = namaLengkap.replace(/'/g, "\\'");
                
                // --- INJEKSI UI/UX: LOGIKA PEMBACAAN PRESISI & TRANSFORMASI VISUAL ---
                // 1. Perbaikan Bug Centang: Paksa ID menjadi Teks agar cocok 100%
                let itemTerpilih = seleksiPiutangEceran.find(x => x.id.toString() === itemDb.id.toString());
                let isChecked = itemTerpilih ? 'checked' : '';
                
                let checkboxHtml = `
                <div class="relative flex items-center justify-center pt-0.5 z-20">
                    <input type="checkbox" ${isChecked} onchange="togglePilihPiutangAman('${itemDb.id}', '${namaObatParam}', ${itemDb.sisaTagihan}, ${itemDb.qtySisa}, '${p.nama}', this)" class="w-4 h-4 text-emerald-500 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shadow-sm">
                </div>`;

                // 2. Transformasi Desain: Berubah warna dan teks saat masuk keranjang
                let bgBaris = itemTerpilih ? 'bg-emerald-50 border border-emerald-200 shadow-inner' : 'hover:bg-slate-100 border border-transparent';
                
                let teksTebus = itemTerpilih ? 
                    `<span class="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-black ml-1.5 shadow-sm border border-emerald-200">Ditebus x${itemTerpilih.qtyTebus} dari ${itemDb.qtySisa}</span>` 
                    : ` <span class="text-slate-500">(x${itemDb.qtySisa})</span>`;
                    
                let nominalTampil = itemTerpilih ? itemTerpilih.hargaTebus : itemDb.sisaTagihan;
                let warnaNominal = itemTerpilih ? 'text-emerald-700 font-black' : 'text-slate-800 font-black';

                return `
                <div class="flex items-start w-full mb-1.5 group/item p-1.5 -mx-1.5 rounded-lg transition-all cursor-pointer ${bgBaris}">
                    <div class="flex items-start gap-2 shrink-0">${checkboxHtml}</div>
                    <div class="text-[10.5px] text-slate-700 font-semibold leading-tight pt-0.5 flex-1 pl-1">${namaLengkap}${teksTebus}</div>
                    <div class="w-[80px] shrink-0 flex items-start pt-0.5 text-[11px] ${warnaNominal} pl-1">
                        <span class="w-[20px]">Rp</span><span class="flex-1 text-right">${(nominalTampil).toLocaleString('id-ID')}</span>
                    </div>
                </div>`;
            }).join('');

            let totalWaktuHtml = isMultiDalamSatuWaktu ? `<span class="font-black text-red-600 text-xs bg-red-50 px-2 py-1 rounded-md border border-red-100 shadow-inner">${rupiah(grup.totalWaktuIni)}</span>` : '';

            return `
            <div class="bg-white border border-red-200 rounded-xl p-3.5 mb-3 shadow-sm relative overflow-hidden">
                <div class="absolute left-0 top-0 bottom-0 w-1 bg-red-400"></div>
                <div class="flex justify-between items-center border-b border-slate-100 pb-2.5 mb-2.5 pl-1.5">
                    <span class="text-[10px] font-bold text-slate-500 flex items-center gap-1.5"><i class="fa-regular fa-calendar-days text-slate-400"></i> ${grup.tanggal} (${grup.waktu})</span>
                    ${totalWaktuHtml}
                </div>
                <div class="pl-1.5 mb-3">${itemLines}</div>
                <div class="pl-1.5">
                    <button onclick="lompatKeRiwayat('${grup.tanggal}', '${grup.waktu}', '${p.nama}')" class="text-[9px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1.5 w-max active:scale-95 shadow-sm">
                        <i class="fa-solid fa-clock-rotate-left"></i> Cek Jejak Asli
                    </button>
                </div>
            </div>`;
        }).join('');

        let zonaHijauHtml = '';
        if (p.riwayatLunas.length > 0) {
            p.riwayatLunas.sort((a, b) => b.id - a.id);
            let limitTampil = p.riwayatLunas;
            
                        let lunasLines = limitTampil.map(lunasDb => {
                let waktuAsal = '-';
                let btnJejakHtml = ''; // Siapkan variabel untuk tombol Cek Jejak Asli
                
                if(lunasDb.idTerkait) {
                    let utangAsal = cashierHistory.find(x => x.id.toString() === lunasDb.idTerkait.toString());
                    if(utangAsal) {
                        waktuAsal = `${utangAsal.tanggal} (${utangAsal.waktu})`;
                        // Tombol Cek Jejak Asli yang mengarah ke nota utang aslinya (Hutang Asal)
                        btnJejakHtml = `
                        <div class="mt-2.5">
                            <button onclick="lompatKeRiwayat('${utangAsal.tanggal}', '${utangAsal.waktu}', '${p.nama}')" class="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 w-max active:scale-95 shadow-sm">
                                <i class="fa-solid fa-clock-rotate-left"></i> Cek Jejak Asli
                            </button>
                        </div>`;
                    }
                }
                
                let namaObatBersih = lunasDb.obat.replace('PELUNASAN GABUNGAN: ','').replace('Pelunasan Eceran: ','');
                let qtyTebus = lunasDb.item || 1; // Menangkap jumlah stok yang dilunasi
                
                return `
                <div class="bg-white border border-emerald-200 rounded-xl p-3 mb-2 shadow-sm relative overflow-hidden">
                    <div class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400"></div>
                    <div class="flex justify-between items-center mb-2 pl-1.5 border-b border-emerald-50 pb-2">
                        <span class="text-[10px] font-black text-emerald-600 flex items-center gap-1.5"><i class="fa-solid fa-check-circle"></i> BUKTI PELUNASAN</span>
                        <span class="font-black text-emerald-700 text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">+ Rp <span class="inline-block w-[45px] text-right">${(lunasDb.total).toLocaleString('id-ID')}</span></span>
                    </div>
                    <div class="pl-1.5 space-y-0.5 mt-1">
                        <p class="text-[9px] text-slate-600 font-bold"><span class="inline-block w-16 text-slate-400">Waktu Bayar</span>: ${lunasDb.tanggal} (${lunasDb.waktu})</p>
                        <p class="text-[9px] text-slate-600 font-bold"><span class="inline-block w-16 text-slate-400">Hutang Asal</span>: ${waktuAsal}</p>
                        <p class="text-[9px] text-slate-600 font-bold"><span class="inline-block w-16 text-slate-400">Metode</span>: <span class="text-blue-600 uppercase font-black">${lunasDb.metodeBayar || lunasDb.metode}</span></p>
                        <div class="border-t border-dashed border-emerald-100 my-1.5"></div>
                        <p class="text-[9px] text-slate-500 font-medium italic leading-tight">Menebus: <span class="text-slate-700 font-bold">${namaObatBersih} <span class="text-emerald-600 font-black">(x${qtyTebus})</span></span></p>
                        ${btnJejakHtml}
                    </div>
                </div>`;
            }).join('');

            
            zonaHijauHtml = `<div class="mt-5 pt-4 border-t border-slate-200"><div class="flex items-center gap-2 mb-3"><div class="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><i class="fa-solid fa-clock-rotate-left text-[10px]"></i></div><p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Riwayat Pelunasan Abadi</p></div>${lunasLines}</div>`;
        }
        
        let totalStokGantung = 0;
        p.idsAktif.forEach(id => { 
            let t = cashierHistory.find(x => x.id === id); 
            if(t) {
                let historiCicilan = cashierHistory.filter(o => o.isPelunasan && o.idTerkait == t.id && !o.isIndukBorongan);
                let qtyTertebus = historiCicilan.reduce((sum, o) => sum + (o.item || 0), 0);
                totalStokGantung += ((t.item || 1) - qtyTertebus); 
            }
        });
        
        if (p.totalAktif === 0) {
            zonaMerahHtml = `<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3 text-center shadow-sm"><p class="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-0.5"><i class="fa-solid fa-circle-check text-lg mb-1 block"></i> STATUS BERSIH</p><p class="text-[9px] font-bold text-emerald-800">Tidak ada tunggakan aktif.</p></div>`;
        }

                let keranjangOrangIni = seleksiPiutangEceran.filter(x => x.namaPelanggan === p.nama);
        
        // LOGIKA BARU: Wajib Centang (Tombol Default Mati/Abu-abu)
        let teksTombolLunas = 'PILIH ITEM DULU';
        let btnColorClass = 'from-slate-400 to-slate-500 border-slate-300 opacity-70';
        let totalTagihanTombol = 0;
        let funcTombol = `alert('Silakan centang item utang di atas yang ingin dilunasi terlebih dahulu.')`;
        
        // Jika sudah ada yang dicentang, tombol hidup (Hijau)
        if(keranjangOrangIni.length > 0) {
            totalTagihanTombol = keranjangOrangIni.reduce((sum, i) => sum + i.hargaTebus, 0);
            teksTombolLunas = 'LUNASI TERPILIH';
            btnColorClass = 'from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 border-emerald-400 shadow-[0_4px_15px_rgba(16,185,129,0.3)]';
            funcTombol = `bukaModalPelunasanMobile('CERDAS', '${p.nama}', ${totalTagihanTombol})`;
        }
        
        let tampilanTombolBawah = p.totalAktif > 0 ? `<button onclick="${funcTombol}" class="w-full bg-gradient-to-r ${btnColorClass} text-white font-black py-4 rounded-xl transition-transform active:scale-95 flex items-center justify-center gap-2 text-[13px] uppercase tracking-wider border"><i class="fa-solid fa-hand-holding-dollar text-lg"></i> ${teksTombolLunas} ${keranjangOrangIni.length > 0 ? '(' + rupiah(totalTagihanTombol) + ')' : ''}</button>` : '';

                return `
        <div id="kartu-piutang-${p.nama.replace(/\s/g,'')}" onpointerdown="mulaiTekanPiutang('${p.nama}', ${p.totalAktif})" onpointerup="lepasTekanPiutang()" onpointerleave="lepasTekanPiutang()" class="bg-slate-50 border-2 border-slate-200 rounded-[1.5rem] p-5 shadow-md relative transition-all duration-500 overflow-hidden cursor-pointer select-none">
            <div class="absolute top-0 right-0 w-24 h-24 bg-white rounded-bl-full -z-0 opacity-60 pointer-events-none"></div>
   <div class="flex justify-between items-start mb-4 relative z-10">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xl shadow-inner border border-slate-300"><i class="fa-solid fa-user"></i></div>
                   <div>
                        <h4 class="font-black text-slate-800 text-lg uppercase tracking-tight leading-none mb-1">${p.nama}</h4>
                        <p class="text-[10px] font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-md inline-block">${p.idsAktif.length} Item (${totalStokGantung} Stok) Menggantung</p>
                    </div>
                </div>
                <div class="flex gap-2 shrink-0">
                    <button onclick="tagihWAMultiPiutang('${p.nama}')" class="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-200 shadow-sm active:scale-95 transition-transform" title="Kirim Tagihan WA"><i class="fa-brands fa-whatsapp text-xl"></i></button>
                    <button onclick="bukaKasirKhususPiutang('${p.nama}', '${p.wa || ''}')" class="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-200 shadow-sm active:scale-95 transition-transform" title="Tambah Utang Baru"><i class="fa-solid fa-cart-plus text-lg"></i></button>
                </div>
            </div>
            <div class="mb-2 relative z-10">
                <div class="flex items-center gap-2 mb-3">
                    <div class="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600"><i class="fa-solid fa-triangle-exclamation text-[10px] animate-pulse"></i></div>
                    <p class="text-[10px] font-black text-red-600 uppercase tracking-widest">Tunggakan Aktif</p>
                </div>
                <div class="max-h-[300px] overflow-y-auto hide-scrollbar pb-1">${zonaMerahHtml}</div>
            </div>
            <div class="relative z-10">${zonaHijauHtml}</div>
            <div class="bg-white border border-slate-200 rounded-xl p-4 mt-4 relative z-10 shadow-sm">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-black text-slate-500 uppercase tracking-wider">Total Tunggakan</span>
                    <span class="text-2xl font-black text-red-600 tracking-tight drop-shadow-sm">${rupiah(p.totalAktif)}</span>
                </div>
                ${tampilanTombolBawah}
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

// FUNGSI MESIN WAKTU -> RIWAYAT TANGGAL ASLI & PORTAL ANIMASI
function lompatKeRiwayat(tanggal, waktuJam, nama) {
    document.getElementById('filterTglRiwayatMobile').value = tanggal;
    ubahTabRiwayat('semua');
    bukaLayar('riwayat');
    
    // Jika dipanggil tanpa waktu spesifik, cukup buka harinya saja
    if(!waktuJam || !nama) {
        setTimeout(() => showToast(`⏰ Melompat ke arsip tanggal ${tanggal}`), 300);
        return;
    }

    // Mesin Animasi Pencari Kotak Waktu (Presisi Tinggi)
    setTimeout(() => {
        // Membersihkan titik/titik dua pada jam, dan memaksa NAMA jadi UPPERCASE
        let idTarget = `kartu-riwayat-${waktuJam.replace(/[:\.]/g,'')}-${nama.toUpperCase().replace(/\s/g,'')}`;
        let kotakTujuan = document.getElementById(idTarget);
        
        if(kotakTujuan) {
            kotakTujuan.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Efek Sihir Nyala Kuning
            kotakTujuan.classList.add('bg-amber-100', 'border-amber-400', 'shadow-[0_0_20px_rgba(251,191,36,0.5)]');
            kotakTujuan.classList.remove('bg-white', 'border-slate-200');
            setTimeout(() => {
                kotakTujuan.classList.remove('bg-amber-100', 'border-amber-400', 'shadow-[0_0_20px_rgba(251,191,36,0.5)]');
                kotakTujuan.classList.add('bg-white', 'border-slate-200');
            }, 2500); 
            showToast(`⏰ Tiba di riwayat ${waktuJam}`);
        } else {
            alert(`⚠️ JEJAK TIDAK DITEMUKAN\n\nStruk pada pukul ${waktuJam} atas nama ${nama} tidak ditemukan di layar Riwayat ini.`);
        }
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

// ==========================================
// MESIN HAPUS PIUTANG (SINGLE TARGET - LONG PRESS)
// ==========================================
let timerTekanPiutang;

function mulaiTekanPiutang(namaPelanggan, totalAktif) {
    timerTekanPiutang = setTimeout(() => {
        triggerHaptic([50, 100]);
        validasiHapusPiutangLunas(namaPelanggan, totalAktif);
    }, 600); // Tahan selama 600 milidetik untuk memicu
}

function lepasTekanPiutang() {
    clearTimeout(timerTekanPiutang);
}

function validasiHapusPiutangLunas(namaPelanggan, totalAktif) {
    // 1. PENOLAKAN MUTLAK JIKA BELUM LUNAS TOTAL
    if (totalAktif > 0) {
        triggerHaptic([100, 50, 100, 50]); // Getar peringatan keras
        alert(`🛡️ AKSES DITOLAK!\n\nPelanggan ${namaPelanggan} masih memiliki tunggakan sebesar ${rupiah(totalAktif)}.\nFitur pembersihan arsip ini HANYA BERLAKU untuk piutang yang sudah Lunas Total.`);
        return;
    }

    // 2. EFEK VISUAL: Kartu menyala merah sebagai tanda target terkunci
    let idKartu = `kartu-piutang-${namaPelanggan.replace(/\s/g,'')}`;
    let kartu = document.getElementById(idKartu);
    if(kartu) {
        kartu.classList.remove('border-slate-200');
        kartu.classList.add('border-red-500', 'shadow-[0_0_25px_rgba(239,68,68,0.5)]', 'bg-red-50');
    }

    // 3. KONFIRMASI PEMUSNAHAN
    tampilkanConfirmMobile(`🗑️ HAPUS ARSIP LUNAS\n\nHapus seluruh riwayat utang dan bukti bayar atas nama ${namaPelanggan} secara permanen dari sistem?\n\n(Peringatan: Pastikan Anda sudah mencetak/tutup buku periode ini).`, function() {
        
        // EKSEKUSI: Filter membuang utang dan pelunasan milik pelanggan ini saja
        cashierHistory = cashierHistory.filter(t => {
            let namaOrang = (t.pelanggan || '').trim().toUpperCase();
            let isTarget = (namaOrang === namaPelanggan) && (t.metode === 'Debt' || t.isPelunasan);
            return !isTarget; // Hanya simpan data yang BUKAN target
        });

        saveApotekDB('apotek_cashierHistory', cashierHistory);
        renderPiutangMobile();
        triggerHaptic([100, 50, 100]);
        alert(`✅ Arsip piutang atas nama ${namaPelanggan} berhasil dibersihkan dari sistem.`);
        
    });

    // 4. BERSIHKAN EFEK VISUAL JIKA BATAL
    setTimeout(() => {
        if(kartu) {
            kartu.classList.add('border-slate-200');
            kartu.classList.remove('border-red-500', 'shadow-[0_0_25px_rgba(239,68,68,0.5)]', 'bg-red-50');
        }
    }, 2500);
}

// MESIN PEMBELAH SEL (CHECKBOX AMAN)
function togglePilihPiutangAman(id, namaObat, totalHarga, qtyMax, namaPelanggan, element) {
    if(element.checked) {
        if(qtyMax > 1) {
            let inputQty = prompt(`${namaPelanggan} berutang ${qtyMax} stok ${namaObat}.\nBerapa stok yang ingin ditebus sekarang?`, "1");
            let qtyTebus = parseInt(inputQty);
            if(isNaN(qtyTebus) || qtyTebus <= 0 || qtyTebus > qtyMax) {
                element.checked = false;
                return alert("⚠️ Jumlah tidak valid. Batal memilih.");
            }
            let hargaPerBiji = totalHarga / qtyMax;
            let hargaTebus = hargaPerBiji * qtyTebus;
            seleksiPiutangEceran.push({ id, namaObat, totalAsli: totalHarga, hargaTebus: hargaTebus, qtyTebus: qtyTebus, qtyMax: qtyMax, namaPelanggan });
        } else {
            seleksiPiutangEceran.push({ id, namaObat, totalAsli: totalHarga, hargaTebus: totalHarga, qtyTebus: 1, qtyMax: 1, namaPelanggan });
        }
    } else {
        seleksiPiutangEceran = seleksiPiutangEceran.filter(x => x.id !== id);
    }
    renderPiutangMobile(); // Refresh tombol bawah
}

// MESIN EKSEKUSI PEMBELAH SEL (MURNI FOKUS CENTANG)
function eksekusiPelunasanCerdas(metode) {
    let namaPelanggan = document.getElementById('pelunasanNamaMobile').textContent;
    let keranjangTarget = seleksiPiutangEceran.filter(x => x.namaPelanggan === namaPelanggan);
    if (keranjangTarget.length === 0) return alert("⚠️ Anda belum memilih item utang yang akan dilunasi.");

    let totalBayar = 0; let waPelanggan = '';
    const idPelunasanBaru = Date.now(); const tglWaktu = new Date();
    const strTanggal = getTanggalLokal(); const strWaktu = tglWaktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    keranjangTarget.forEach((sel, idx) => {
        let t = cashierHistory.find(x => x.id.toString() === sel.id.toString());
        if(!t) return;
        totalBayar += sel.hargaTebus; if(t.wa) waPelanggan = t.wa;
        
        let historiCicilan = cashierHistory.filter(p => p.isPelunasan && p.idTerkait == t.id && !p.isIndukBorongan);
        let totalQtyTertebus = historiCicilan.reduce((sum, p) => sum + (p.item || 0), 0);
        
        if((totalQtyTertebus + sel.qtyTebus) >= (t.item || 1)) { t.statusLunas = true; } 
        
        cashierHistory.unshift({
            id: idPelunasanBaru + idx, tanggal: strTanggal, waktu: strWaktu,
            obat: `Pelunasan Eceran: ${sel.namaObat.replace(/ \([^)]*\)/, '')}`, 
            kasir: 'Pemilik', item: sel.qtyTebus, total: sel.hargaTebus, metode: 'Tunai', metodeBayar: metode, laba: 0, pelanggan: namaPelanggan, wa: waPelanggan, isPelunasan: true, idTerkait: sel.id
        });
    });
    
    seleksiPiutangEceran = seleksiPiutangEceran.filter(x => x.namaPelanggan !== namaPelanggan);

    if (totalBayar > 0) {
        siklusAktif.uangMasuk += totalBayar;
        kirimNotifikasiMobile('Pelunasan Diterima', `Pelunasan kasbon dari ${namaPelanggan} via ${metode}.`, 'lunas', totalBayar);
        saveApotekDB('apotek_cashierHistory', cashierHistory); saveApotekDB('apotek_siklusAktif', siklusAktif);
        tutupModalMobile('modalPelunasanMobile'); renderPiutangMobile(); renderBerandaMobile(); renderRiwayatMobile();
        triggerHaptic([100, 50, 100]); alert(`✅ Pembayaran via ${metode} Berhasil! Transaksi telah dicatat ke Laporan.`);
    }
}

// ==========================================
// MESIN FILTER MULTI-TANGGAL (LAPORAN BUKU BESAR)
// ==========================================
let laporanTglAwal = getTanggalLokal();
let laporanTglAkhir = getTanggalLokal();
let laporanLabelVisual = "Hari Ini";

function toggleDropdownFilterLaporan() {
    const panel = document.getElementById('panelFilterLaporan');
    const icon = document.getElementById('iconDropdownFilterLaporan');
    if(panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        panel.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
}

function formatTanggalPendek(tglStr) { 
    if(!tglStr) return '';
    let pecah = tglStr.split('-'); // [YYYY, MM, DD]
    if(pecah.length !== 3) return tglStr;
    let bln = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    return `${parseInt(pecah[2])} ${bln[parseInt(pecah[1])-1]} ${pecah[0]}`;
}

function setFilterLaporan(tipe) {
    let tglSkrg = new Date();
    if (tipe === 'hari_ini') {
        laporanTglAwal = getTanggalLokal(tglSkrg);
        laporanTglAkhir = getTanggalLokal(tglSkrg);
        laporanLabelVisual = "Hari Ini";
    } else if (tipe === '7_hari') {
        let tglLalu = new Date();
        tglLalu.setDate(tglLalu.getDate() - 6); // Mundur 7 hari
        laporanTglAwal = getTanggalLokal(tglLalu);
        laporanTglAkhir = getTanggalLokal(tglSkrg);
        laporanLabelVisual = "7 Hari Terakhir";
    } else if (tipe === 'semua') {
        laporanTglAwal = "2000-01-01"; 
        laporanTglAkhir = "2099-12-31"; 
        laporanLabelVisual = "Semua Waktu";
    } else if (tipe === 'manual') {
        let awal = document.getElementById('filterTglAwal').value;
        let akhir = document.getElementById('filterTglAkhir').value;
        if(!awal || !akhir) return alert("⚠️ Pilih tanggal Dari dan Sampai terlebih dahulu!");
        if(awal > akhir) return alert("⚠️ Tanggal 'Dari' tidak boleh lebih besar dari 'Sampai'!");
        laporanTglAwal = awal;
        laporanTglAkhir = akhir;
        if(awal === akhir) {
            laporanLabelVisual = formatTanggalPendek(awal);
        } else {
            laporanLabelVisual = `${formatTanggalPendek(awal)} - ${formatTanggalPendek(akhir)}`;
        }
    }
    
    document.getElementById('teksFilterLaporanUi').textContent = laporanLabelVisual;
    toggleDropdownFilterLaporan();
    renderLaporanMobile();
}

function renderLaporanMobile() {
    const wadah = document.getElementById('kontenLaporanMobile');
    
    // =======================================================
    // MESIN 1: KALKULASI RENTANG WAKTU (LABA/RUGI, ARUS KAS, TRAFIK)
    // =======================================================
    let dataPeriode = cashierHistory.filter(t => t.tanggal >= laporanTglAwal && t.tanggal <= laporanTglAkhir);
    let dataKeluar = pengeluaranHistory.filter(p => p.tanggal >= laporanTglAwal && p.tanggal <= laporanTglAkhir);

  
    let lOmset = 0, lHPP = 0, omzetTunai = 0, omzetQRIS = 0, omzetDebt = 0;
    let inLunas = 0, totalPembeli = 0, totalBiji = 0;
    
    dataPeriode.forEach(t => {
        if(!t.isPelunasan) { 
            lOmset += t.total; lHPP += (t.total - t.laba);
            if(t.metode === 'Tunai') omzetTunai += t.total;
            else if(t.metode === 'QRIS') omzetQRIS += t.total;
            else if(t.metode === 'Debt') omzetDebt += t.total;
            
            totalPembeli++;
            totalBiji += (t.item || 1);
        } else {
            inLunas += (t.total || 0);
        }
    });

    let bBiayaToko = 0, bPrive = 0, bKulakan = 0;
    let listKulakanHtml = '', listBiayaHtml = '', listPriveHtml = '';
    
    dataKeluar.forEach(p => {
        if (p.kategori === 'Biaya Toko') { 
            bBiayaToko += p.nominal; 
            listBiayaHtml += `<div class="flex justify-between gap-2 text-[8.5px] text-slate-400 mb-1"><span class="truncate">&bull; ${p.keterangan}</span><span class="text-rose-400 font-mono shrink-0">-${rupiah(p.nominal)}</span></div>`;
        }
        else if (p.kategori === 'Prive') { 
            bPrive += p.nominal; 
            listPriveHtml += `<div class="flex justify-between gap-2 text-[8.5px] text-slate-400 mb-1"><span class="truncate">&bull; ${p.keterangan}</span><span class="text-rose-400 font-mono shrink-0">-${rupiah(p.nominal)}</span></div>`;
        }
        else if (p.kategori === 'Kulakan') { 
            bKulakan += p.nominal; 
            listKulakanHtml += `<div class="flex justify-between gap-2 text-[8.5px] text-slate-400 mb-1"><span class="truncate">&bull; ${p.keterangan}</span><span class="text-rose-400 font-mono shrink-0">-${rupiah(p.nominal)}</span></div>`;
        }
    });

    let labaKotor = lOmset - lHPP;
    let labaBersihSejati = labaKotor - bBiayaToko; 
    let labaDitahan = labaBersihSejati - bPrive;
    
    let aov = totalPembeli > 0 ? (lOmset / totalPembeli) : 0;
    let margin = lOmset > 0 ? ((labaBersihSejati / lOmset) * 100).toFixed(1) : 0;

    // =======================================================
    // MESIN 2: KALKULASI REAL-TIME (NERACA HARTA KEKAYAAN)
    // =======================================================
    let estimasiIsiLaci = hitungSaldoLaciFisik(); 

    let hartaQRIS = 0;
    cashierHistory.forEach(t => {
        if(t.metode === 'QRIS' && !t.isPelunasan) hartaQRIS += (t.total || 0);
        if(t.isPelunasan && (t.metodeBayar === 'QRIS' || t.metodeBayar === 'qris' || t.metode === 'QRIS')) hartaQRIS += (t.total || 0);
    });

    let hartaPiutang = 0; let hutangMap = {};
    cashierHistory.filter(t => t.metode === 'Debt' || t.isPelunasan).forEach(t => {
        if(t.metode === 'Debt' && !t.statusLunas) hutangMap[t.id] = t.total;
        if(t.isPelunasan && t.idTerkait && hutangMap[t.idTerkait]) hutangMap[t.idTerkait] -= t.total;
    });
    Object.values(hutangMap).forEach(v => { if(v > 0) hartaPiutang += v; });

    let sisaQtyReal = 0; let sisaRpReal = 0;
    masterItems.filter(i => i.nama !== '___SYSTEM_AUTH___' && i.kategori !== '⚠️ Barang Retur').forEach(b => { 
        sisaQtyReal += (b.stok || 0); sisaRpReal += (b.totalModal !== undefined ? b.totalModal : (b.modal * b.stok)); 
    });
    etalaseItems.forEach(b => {
        sisaQtyReal += (b.stok || 0);
        if(b.antreanFIFO && b.antreanFIFO.length > 0) {
            b.antreanFIFO.forEach(f => sisaRpReal += (f.totalModal !== undefined ? f.totalModal : (f.modal * f.stok)));
        } else {
            let m = masterItems.find(x => x.dnaInduk === b.dnaInduk || x.nama === b.nama);
            sisaRpReal += (m ? (m.modal || 0) : 0) * (b.stok || 0);
        }
    });

    // =======================================================
    // MESIN 3: KALKULASI SIKLUS PERSEDIAAN
    // =======================================================
    let terjualQtySiklus = 0; let terjualRpSiklus = 0;
    let wMulai = siklusAktif.waktuStart || 0;
    cashierHistory.filter(t => (wMulai ? t.id >= wMulai : t.tanggal >= siklusAktif.tanggalStart) && !t.isPelunasan).forEach(t => {
        terjualQtySiklus += (t.item || 1);
        terjualRpSiklus += ((t.total || 0) - (t.laba || 0));
    });

    let totalQtyTersedia = (siklusAktif.qtyAwal || 0) + (siklusAktif.qtyTambahan || 0);
    let totalModalTersedia = (siklusAktif.modalAwal || 0) + (siklusAktif.modalTambahan || 0);

    // =======================================================
    // RENDERING UI: AKORDEON DINAMIS & TERTUTUP AWAL
    // =======================================================
    wadah.innerHTML = `
    <div class="flex flex-col gap-3 pb-4">
        
        <!-- BLOK I: ALUR MODAL PERSEDIAAN -->
        <div class="bg-[#24272c] border border-[#3b3f46] rounded-sm shadow-sm select-none">
            <div class="flex justify-between items-center p-3.5 cursor-pointer" onclick="toggleAkordeonLaporan('blok-persediaan')">
                <h3 class="text-[#93c5fd] font-bold text-[10px] uppercase tracking-widest"><i class="fa-solid fa-boxes-stacked mr-1"></i> I. Alur Modal Persediaan</h3>
                <i class="fa-solid fa-chevron-down text-slate-400 text-[10px] transition-transform duration-300" id="icon-blok-persediaan"></i>
            </div>
            
            <!-- Rincian Tersembunyi -->
            <div id="blok-persediaan" class="hidden px-3.5 pb-3.5 border-t border-[#3b3f46] pt-3">
                <div class="flex justify-between items-center mb-1.5 text-[10px]">
                    <span class="text-slate-400">Modal Awal / Titik Nol</span>
                    <span class="font-mono text-slate-200">${siklusAktif.qtyAwal} Pcs | ${rupiah(siklusAktif.modalAwal)}</span>
                </div>
                <div class="flex justify-between items-center mb-1.5 text-[10px]">
                    <span class="text-slate-400">(+) Suntikan Kulakan</span>
                    <span class="font-mono text-emerald-400">+ ${siklusAktif.qtyTambahan} Pcs | + ${rupiah(siklusAktif.modalTambahan)}</span>
                </div>
                <div class="border-t border-[#3b3f46] my-1.5 pt-1.5 flex justify-between items-center text-[10px]">
                    <span class="font-bold text-slate-300">(=) Total Persediaan Siap Jual</span>
                    <span class="font-bold font-mono text-blue-300">${totalQtyTersedia} Pcs | ${rupiah(totalModalTersedia)}</span>
                </div>
                <div class="flex justify-between items-center mb-1.5 text-[10px] mt-1.5">
                    <span class="text-slate-400">(-) Keluar Terjual (HPP)</span>
                    <span class="font-mono text-rose-400">- ${terjualQtySiklus} Pcs | - ${rupiah(terjualRpSiklus)}</span>
                </div>
                <div class="border-t border-dashed border-[#3b3f46] my-2"></div>
                <div class="flex justify-between items-center text-[10.5px]">
                    <span class="font-bold text-white">(=) Aset Mengendap di Rak</span>
                    <span class="font-bold font-mono text-white tracking-tight">${sisaQtyReal} Pcs | ${rupiah(sisaRpReal)}</span>
                </div>
            </div>
        </div>

        <!-- BLOK II: KINERJA PENJUALAN -->
        <div class="bg-[#f8fafc] border border-slate-300 rounded-sm shadow-sm text-slate-800 select-none">
            <div class="flex justify-between items-center p-3.5 cursor-pointer" onclick="toggleAkordeonLaporan('blok-penjualan')">
                <h3 class="text-[#0f766e] font-bold text-[10px] uppercase tracking-widest"><i class="fa-solid fa-scale-balanced mr-1"></i> II. Kinerja Penjualan</h3>
                <div class="flex items-center gap-2">
                    <span class="text-[8px] font-bold text-slate-500 uppercase border border-slate-300 px-1 rounded-sm tracking-widest">${laporanLabelVisual}</span>
                    <i class="fa-solid fa-chevron-down text-slate-400 text-[10px] transition-transform duration-300" id="icon-blok-penjualan"></i>
                </div>
            </div>
            
            <!-- Rincian Tersembunyi -->
            <div id="blok-penjualan" class="hidden px-3.5 pb-3.5 border-t border-slate-300 pt-3">
                <p class="text-[9px] font-black text-slate-500 mb-1.5 uppercase">A. Pendapatan Kotor (Omzet)</p>
                <div class="flex justify-between text-[10px] mb-1 pl-2"><span class="text-slate-600">Tunai</span><span class="font-mono">${rupiah(omzetTunai)}</span></div>
                <div class="flex justify-between text-[10px] mb-1 pl-2"><span class="text-slate-600">QRIS / Bank</span><span class="font-mono">${rupiah(omzetQRIS)}</span></div>
                <div class="flex justify-between text-[10px] mb-1.5 pl-2"><span class="text-slate-600">Kasbon (Barang Keluar)</span><span class="font-mono">${rupiah(omzetDebt)}</span></div>
                <div class="flex justify-between text-[10px] font-bold border-b border-slate-200 pb-1.5 mb-2 pl-2"><span class="text-slate-800">Total Penciptaan Omzet</span><span class="font-mono text-[#0f766e]">${rupiah(lOmset)}</span></div>

                <div class="flex justify-between text-[10px] mb-3 pl-2"><span class="text-[#0f766e] font-bold">(+) Terima Pelunasan Piutang</span><span class="font-mono text-[#0f766e]">+ ${rupiah(inLunas)}</span></div>

                <p class="text-[9px] font-black text-slate-500 mb-1.5 uppercase">B. Beban & Biaya</p>
                <div class="flex justify-between text-[10px] mb-1 pl-2"><span class="text-slate-600">Modal Terjual (HPP)</span><span class="font-mono text-rose-600">- ${rupiah(lHPP)}</span></div>
                <div class="flex justify-between text-[10px] mb-1.5 pl-2"><span class="text-slate-600">Biaya Toko (Operasional)</span><span class="font-mono text-rose-600">- ${rupiah(bBiayaToko)}</span></div>
                
                <div class="border-t border-slate-400 mt-2 pt-2 flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <span class="font-black text-[11px] uppercase">Laba Bersih Opr.</span>
                        <span class="bg-[#0f766e] text-white text-[8px] px-1 rounded-sm font-black">${margin}% Margin</span>
                    </div>
                    <span class="font-black font-mono text-[13px] tracking-tight ${labaBersihSejati >= 0 ? 'text-[#166534]' : 'text-rose-600'}">${rupiah(labaBersihSejati)}</span>
                </div>
            </div>
        </div>

        <!-- BLOK RINCIAN KAS KELUAR -->
        <div class="bg-[#24272c] border border-[#3b3f46] rounded-sm shadow-sm text-slate-200 select-none">
            <div class="flex justify-between items-center p-3.5 cursor-pointer" onclick="toggleAkordeonLaporan('blok-kaskeluar')">
                 <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><i class="fa-solid fa-file-invoice"></i> Rincian Kas Keluar</p>
                 <div class="flex items-center gap-2">
                    <span class="text-[11px] font-black text-rose-400 font-mono tracking-tight">- ${rupiah(bKulakan + bBiayaToko + bPrive)}</span>
                    <i class="fa-solid fa-chevron-down text-slate-400 text-[10px] transition-transform duration-300" id="icon-blok-kaskeluar"></i>
                 </div>
            </div>
            
            <!-- Rincian Tersembunyi -->
            <div id="blok-kaskeluar" class="hidden px-3.5 pb-3.5 border-t border-[#3b3f46] pt-2 space-y-2">
                ${listKulakanHtml ? `<div class="bg-[#1e2329] border border-[#3b3f46] p-2 rounded-sm"><p class="text-[8px] text-blue-400 font-black uppercase mb-1.5">Faktur Kulakan</p>${listKulakanHtml}</div>` : ''}
                ${listBiayaHtml ? `<div class="bg-[#1e2329] border border-[#3b3f46] p-2 rounded-sm"><p class="text-[8px] text-orange-400 font-black uppercase mb-1.5">Biaya Toko</p>${listBiayaHtml}</div>` : ''}
                ${listPriveHtml ? `<div class="bg-[#1e2329] border border-[#3b3f46] p-2 rounded-sm"><p class="text-[8px] text-purple-400 font-black uppercase mb-1.5">Prive (Ambilan Pribadi)</p>${listPriveHtml}</div>` : ''}
                ${(!listKulakanHtml && !listBiayaHtml && !listPriveHtml) ? `<p class="text-[9px] text-slate-500 italic">Tidak ada catatan kas keluar.</p>` : ''}
            </div>
        </div>

        <!-- BLOK III: TRAFIK & EKUITAS (BARU) -->
        <div class="bg-[#24272c] border border-[#3b3f46] rounded-sm shadow-sm text-slate-200 select-none">
            <div class="flex justify-between items-center p-3.5 cursor-pointer" onclick="toggleAkordeonLaporan('blok-trafik')">
                <h3 class="text-[#fcd34d] font-bold text-[10px] uppercase tracking-widest"><i class="fa-solid fa-chart-line mr-1"></i> III. Analisis Trafik & Ekuitas</h3>
                <i class="fa-solid fa-chevron-down text-slate-400 text-[10px] transition-transform duration-300" id="icon-blok-trafik"></i>
            </div>
            
            <!-- Rincian Tersembunyi -->
            <div id="blok-trafik" class="hidden px-3.5 pb-3.5 border-t border-[#3b3f46] pt-3">
                <div class="grid grid-cols-3 gap-2 mb-3">
                    <div class="border border-[#3b3f46] rounded-sm p-2 text-center bg-[#1e2329]">
                        <p class="text-[8px] font-bold text-slate-400 uppercase mb-1">Total Nota</p>
                        <p class="text-[12px] font-black text-white">${totalPembeli}</p>
                    </div>
                    <div class="border border-[#3b3f46] rounded-sm p-2 text-center bg-[#1e2329]">
                        <p class="text-[8px] font-bold text-slate-400 uppercase mb-1">Terjual</p>
                        <p class="text-[12px] font-black text-white">${totalBiji} Biji</p>
                    </div>
                    <div class="border border-[#3b3f46] rounded-sm p-2 text-center bg-[#1e2329]">
                        <p class="text-[8px] font-bold text-slate-400 uppercase mb-1">Rata-rata Nota</p>
                        <p class="text-[10px] font-black text-emerald-400 font-mono">${rupiah(Math.round(aov))}</p>
                    </div>
                </div>

                <div class="flex justify-between items-center text-[10px] mb-1">
                    <span class="text-slate-400">Laba Bersih</span>
                    <span class="font-mono text-slate-200">${rupiah(labaBersihSejati)}</span>
                </div>
                <div class="flex justify-between items-center text-[10px] border-b border-[#3b3f46] pb-1.5 mb-1.5">
                    <span class="text-slate-400">(-) Prive (Ambilan Pribadi)</span>
                    <span class="font-mono text-rose-400">- ${rupiah(bPrive)}</span>
                </div>
                <div class="flex justify-between items-center text-[10.5px]">
                    <span class="font-bold text-white">Laba Ditahan (Tumbuh)</span>
                    <span class="font-bold font-mono ${labaDitahan >= 0 ? 'text-[#fcd34d]' : 'text-rose-500'} tracking-tight">${rupiah(labaDitahan)}</span>
                </div>
            </div>
        </div>

        <!-- BLOK IV: NERACA KEKAYAAN (GOLD CARD) -->
        <div class="bg-gradient-to-br from-[#cfa950] to-[#997321] border border-[#ebd088] rounded-sm shadow-md text-[#332508] mt-1 select-none">
            <div class="flex justify-between items-center p-3.5 cursor-pointer" onclick="toggleAkordeonLaporan('blok-neraca')">
                <h3 class="font-black text-[10px] uppercase tracking-widest"><i class="fa-solid fa-vault mr-1"></i> IV. Neraca Kekayaan (Detik Ini)</h3>
                <i class="fa-solid fa-chevron-down text-[#6b4e12] text-[10px] transition-transform duration-300" id="icon-blok-neraca"></i>
            </div>
            
            <!-- Rincian Tersembunyi -->
            <div id="blok-neraca" class="hidden px-3.5 pb-3.5 border-t border-[#a6802e] pt-3">
                <div class="grid grid-cols-[max-content_1fr_max-content] gap-x-2 items-end mb-1.5 text-[10px] font-semibold">
                    <span>1. Harta Tunai (Laci Fisik)</span>
                    <div class="border-b border-dotted border-[#8c6b24] mb-1"></div>
                    <span class="font-mono font-black text-[#1d1504]">${rupiah(estimasiIsiLaci)}</span>
                </div>
                <div class="grid grid-cols-[max-content_1fr_max-content] gap-x-2 items-end mb-1.5 text-[10px] font-semibold">
                    <span>2. Harta Bank (QRIS)</span>
                    <div class="border-b border-dotted border-[#8c6b24] mb-1"></div>
                    <span class="font-mono font-black text-[#1d1504]">${rupiah(hartaQRIS)}</span>
                </div>
                <div class="grid grid-cols-[max-content_1fr_max-content] gap-x-2 items-end mb-1.5 text-[10px] font-semibold">
                    <span>3. Harta Piutang (Di Luar)</span>
                    <div class="border-b border-dotted border-[#8c6b24] mb-1"></div>
                    <span class="font-mono font-black text-[#1d1504]">${rupiah(hartaPiutang)}</span>
                </div>
                <div class="grid grid-cols-[max-content_1fr_max-content] gap-x-2 items-end mb-2.5 text-[10px] font-semibold">
                    <span>4. Harta Barang (Nilai Rak)</span>
                    <div class="border-b border-dotted border-[#8c6b24] mb-1"></div>
                    <span class="font-mono font-black text-[#1d1504]">${rupiah(sisaRpReal)}</span>
                </div>
                
                <div class="border-t border-[#8c6b24] pt-2 flex justify-between items-center mt-1">
                    <span class="font-black text-[10px] uppercase">TOTAL ASET KESELURUHAN</span>
                    <span class="font-black font-mono text-[14px] tracking-tight">${rupiah(estimasiIsiLaci + hartaQRIS + hartaPiutang + sisaRpReal)}</span>
                </div>
            </div>
        </div>

    </div>`;
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
    let waktuMulai = siklusAktif.waktuStart || 0; // KUNCI SHIFT: Membaca jam Tutup Buku terakhir
    
    // Setting Header
    document.getElementById('judulLayarRekap').textContent = metodeRekapAktif === 'Tunai' ? 'REKAP TUNAI' : 'REKAP DIGITAL';
    document.getElementById('tanggalLayarRekap').textContent = 'Sesi / Shift Saat Ini';

    // FILTER: Hanya transaksi SETELAH Tutup Buku terakhir (Sistem Shift)
    let dataPeriode = cashierHistory.filter(t => t.id >= waktuMulai && t.metode === metodeRekapAktif && !t.isPelunasan);
    
    let rekapItem = {};
    let grandTotalBiji = 0;
    let grandTotalModal = 0;
    let grandTotalJual = 0;

    dataPeriode.forEach(trx => {
        if (trx.detailKeranjang && trx.detailKeranjang.length > 0) {
            trx.detailKeranjang.forEach(item => {
                let idKunci = item.dnaInduk || item.nama;
                let namaLengkap = item.nama + (item.varian ? ` ${item.varian}` : '');
                
                if(!rekapItem[idKunci]) {
                    rekapItem[idKunci] = { nama: namaLengkap, qty: 0, modal: 0, jual: 0 };
                }
                
                let hpp = item.hppSatuan || Math.round(item.jual * 0.8); 
                let subModal = hpp * item.qty;
                let subJual = item.jual * item.qty;
                
                rekapItem[idKunci].qty += item.qty;
                rekapItem[idKunci].modal += subModal;
                rekapItem[idKunci].jual += subJual;
 
                grandTotalBiji += item.qty;
                grandTotalModal += subModal;
                grandTotalJual += subJual;
            });
        } else {
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
        wadah.innerHTML = `<div class="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm mt-4"><i class="fa-solid fa-box-open text-4xl text-slate-300 mb-3 block"></i><p class="font-bold text-slate-600">Belum ada penjualan ${metodeRekapAktif} di sesi ini.</p></div>`;
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

    document.getElementById('rekapTotalBiji').textContent = grandTotalBiji + " Biji";
    document.getElementById('rekapTotalModal').textContent = rupiah(grandTotalModal);
    document.getElementById('rekapTotalJual').textContent = rupiah(grandTotalJual);
}


// ==========================================
// 7. MESIN MODAL UMUM
// ==========================================
let idBatchAktif = null;

function bukaModalMobile(idModal, idPanel) {
    const modal = document.getElementById(idModal); 
    const panel = document.getElementById(idPanel);
    
    // --- PENYEMPURNAAN UX: Paksa scroll kembali ke paling atas ---
    const areaScroll = panel.querySelector('.overflow-y-auto');
    if (areaScroll) areaScroll.scrollTop = 0;
    // -------------------------------------------------------------

    modal.classList.remove('hidden'); 
    setTimeout(() => { panel.classList.remove('translate-y-full'); }, 10);
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
    
        let barangEtalase = etalaseItems.find(e => e.dnaInduk === dnaIndukTransferAktif);
    if(!barangEtalase) { 
         barangEtalase = { dnaInduk: dnaIndukTransferAktif, nama: namaObat, kategori: kategoriObat, jual: jualObat, varian: varianObat, stok: 0, antreanFIFO: [] };
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
                    
                    // [MODIFIKASI TAHAP 2] - MIGRASI kulakan (Gudang -> Etalase)
                    let sisaPindahkulakan = jumlahDiambil;
                    if (batch.kulakan_keuangan) {
                        for (let f of batch.kulakan_keuangan) {
                            if (sisaPindahkulakan <= 0) break;
                            if (f.sisaGudang > 0) {
                                let ambilDrkulakan = Math.min(sisaPindahkulakan, f.sisaGudang);
                                f.sisaGudang -= ambilDrkulakan;
                                f.sisaEtalase = (f.sisaEtalase || 0) + ambilDrkulakan;
                                sisaPindahkulakan -= ambilDrkulakan;
                            }
                        }
                    }
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

// ==========================================
// MESIN UI CUSTOM DROPDOWN (AMAN DARI CRASH)
// ==========================================
function toggleDropdownCustom(idKey) {
    const menu = document.getElementById('menu_' + idKey);
    const icon = document.getElementById('icon_' + idKey);
    if (menu.classList.contains('hidden')) {
        document.querySelectorAll('.custom-dropdown-menu').forEach(m => m.classList.add('hidden'));
        document.querySelectorAll('.custom-dropdown-icon').forEach(i => i.style.transform = 'rotate(0deg)');
        menu.classList.remove('hidden');
        if(icon) icon.style.transform = 'rotate(180deg)';
    } else {
        menu.classList.add('hidden');
        if(icon) icon.style.transform = 'rotate(0deg)';
    }
}

function pilihDropdownCustom(idKey, nilaiKode, teksTampil, isManual = false) {
    document.getElementById(idKey).value = nilaiKode; // Mengisi Nilai Rahasia (Aman untuk Logika)
    setDropdownUIManual(idKey, teksTampil); // Mengubah Tampilan Kasir
    toggleDropdownCustom(idKey); // Menutup Menu
    
    if (idKey === 'tambahKategoriMobile') {
        let inputKustom = document.getElementById('tambahKategoriKustom');
        if(isManual) { inputKustom.classList.remove('hidden'); inputKustom.focus(); } 
        else { inputKustom.classList.add('hidden'); inputKustom.value = ''; }
    } else if (idKey === 'editKategoriMobile') {
        let inputKustom = document.getElementById('editKategoriKustom');
        if(isManual) { inputKustom.classList.remove('hidden'); inputKustom.focus(); } 
        else { inputKustom.classList.add('hidden'); inputKustom.value = ''; }
    } else if (idKey === 'tambahSatuanEceran' || idKey === 'tambahSatuanBesar') {
        kalkulasiTambahObatCerdas();
    } else if (idKey === 'editSatuanEceran' || idKey === 'editSatuanBesar') {
        kalkulatorEditBatchMobile();
    }
}

function setDropdownUIManual(idKey, teksTampil) {
    const btn = document.getElementById('btn_' + idKey);
    const teks = document.getElementById('teks_' + idKey);
    if(!teks) return;
    teks.innerHTML = teksTampil;
    teks.className = 'truncate font-black text-slate-800 text-sm'; // Teks berubah jadi hitam tebal!
    
    // Perubahan Warna Kotak JIKA itu Satuan Eceran/Besar
    if(idKey.includes('SatuanEceran') || idKey.includes('SatuanBesar')) {
         btn.classList.add('bg-[#eef5ef]', 'border-[#b2d5bb]');
         btn.classList.remove('bg-white', 'bg-slate-50', 'border-slate-200');
    } else {
         btn.classList.add('bg-white');
         btn.classList.remove('bg-slate-50');
    }
}

function resetDropdownUI(idKey, placeholderHtml, isEditMode = false) {
    const btn = document.getElementById('btn_' + idKey);
    const teks = document.getElementById('teks_' + idKey);
    if(!teks || !btn) return;
    document.getElementById(idKey).value = ''; // Kosongkan Nilai Mesin
    teks.innerHTML = placeholderHtml;
    teks.className = 'truncate text-slate-400 text-xs'; // Teks kembali abu-abu buram (Placeholder)
    
    btn.classList.remove('bg-[#eef5ef]', 'border-[#b2d5bb]', 'bg-white');
    if(isEditMode) btn.classList.add('bg-slate-50', 'border-slate-200');
    else btn.classList.add('bg-white', 'border-slate-200');
}

// FUNGSI INI DIBANGUN ULANG AGAR TIDAK CRASH SAAT EDIT OBAT
function isiKategoriEditCerdas(kategori) {
    let inputSelect = document.getElementById('editKategoriMobile');
    let inputKustom = document.getElementById('editKategoriKustom');
    let opsiStandar = ['Sakit Kepala', 'Vitamin', 'Sirup', 'Analgesik', 'Antibiotik', 'Salep'];
    
    if (kategori && !opsiStandar.includes(kategori) && kategori !== 'kustom') {
        inputSelect.value = 'kustom';
        inputKustom.value = kategori;
        inputKustom.classList.remove('hidden');
        setDropdownUIManual('editKategoriMobile', 'Pilih Manual');
    } else {
        inputSelect.value = kategori || '';
        inputKustom.value = '';
        inputKustom.classList.add('hidden');
        if(kategori) setDropdownUIManual('editKategoriMobile', kategori);
        else resetDropdownUI('editKategoriMobile', 'Contoh: <i>Vitamin</i>', true);
    }
}


function siapkanBatchBaruMobile() {
    isAddingNewBatchMobile = true; renderEditTabsMobile();
    let referensi = currentEditBatchesMobile[0];
    
    if(document.getElementById('editQtyBeli')) {
        document.getElementById('editQtyBeli').value = '';
        document.getElementById('editModalKotor').value = '';
        document.getElementById('editIsiPerBox').value = '';
        document.getElementById('editToggleGrosir').checked = false;
        let ecerAwal = (referensi.riwayatAsal && referensi.riwayatAsal.satuanEcer) ? referensi.riwayatAsal.satuanEcer : '';
        document.getElementById('editSatuanEceran').value = ecerAwal;
        document.getElementById('editSatuanBesar').value = '';
        kalkulatorEditBatchMobile(); 
    }
    
    document.getElementById('editNamaMobile').value = referensi.nama; 
    document.getElementById('editVarianMobile').value = referensi.varian || '';
    isiKategoriEditCerdas(referensi.kategori);
    document.getElementById('editModalMobile').value = '';
    document.getElementById('editJualMobile').value = referensi.jual; 
    document.getElementById('editStokMobile').value = '';
    document.getElementById('editExpiredMobile').value = '';
    
    aktifkanModeEditMobile(); 
    document.getElementById('editNamaMobile').readOnly = true; document.getElementById('editNamaMobile').classList.add('bg-slate-200','text-slate-500');
    document.getElementById('editVarianMobile').readOnly = true; document.getElementById('editVarianMobile').classList.add('bg-slate-200','text-slate-500');
    document.getElementById('editKategoriMobile').disabled = true; document.getElementById('editKategoriMobile').classList.add('bg-slate-200','text-slate-500');
        document.getElementById('editJualMobile').readOnly = true; document.getElementById('editJualMobile').classList.add('bg-slate-200','text-slate-500');
    document.getElementById('btnUbahJualMobile').classList.add('hidden');
     
    // --- LOGIKA BARU: KUNCI SAKLAR LACI JIKA SALDO KOSONG ---
    let toggleEditLaciBaru = document.getElementById('editPotongLaciToggle');
    if (toggleEditLaciBaru) {
        toggleEditLaciBaru.checked = false; 
        let wadahEditLaciBaru = toggleEditLaciBaru.parentElement.parentElement; 
        if (hitungSaldoLaciFisik() <= 0) {
            toggleEditLaciBaru.disabled = true;
            if (wadahEditLaciBaru) wadahEditLaciBaru.classList.add('opacity-40', 'grayscale', 'pointer-events-none');
        } else {
            toggleEditLaciBaru.disabled = false;
            if (wadahEditLaciBaru) wadahEditLaciBaru.classList.remove('opacity-40', 'grayscale', 'pointer-events-none');
        }
    }
    // --------------------------------------------------------

    let btnAksi = document.getElementById('btnAksiEditMobile');
  btnAksi.innerHTML = '<i class="fa-solid fa-plus-circle text-lg"></i> Simpan Batch Baru';
    btnAksi.className = 'w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/30 transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm uppercase tracking-wider';
}

function loadFormEditBatchMobile() {
    let barang = currentEditBatchesMobile[activeEditBatchIndexMobile];
    document.getElementById('editNamaMobile').value = barang.nama; 
    document.getElementById('editVarianMobile').value = barang.varian || ''; 
    isiKategoriEditCerdas(barang.kategori);
    document.getElementById('editModalMobile').value = barang.modal;
    document.getElementById('editJualMobile').value = barang.jual; 
    document.getElementById('editStokMobile').value = barang.stok;
    document.getElementById('editExpiredMobile').value = barang.expired || '';
    
    if(barang.riwayatAsal) {
        document.getElementById('editToggleGrosir').checked = barang.riwayatAsal.isGrosir;
        document.getElementById('editQtyBeli').value = barang.riwayatAsal.qtyBeli || '';
        document.getElementById('editSatuanBesar').value = barang.riwayatAsal.satuanBesar || '';
        document.getElementById('editIsiPerBox').value = barang.riwayatAsal.isiPerBox || '';
        document.getElementById('editSatuanEceran').value = barang.riwayatAsal.satuanEcer || '';
        let modalKotorLoaded = barang.riwayatAsal.isGrosir ? (barang.modal * barang.riwayatAsal.isiPerBox) : barang.modal;
        document.getElementById('editModalKotor').value = modalKotorLoaded > 0 ? modalKotorLoaded.toLocaleString('id-ID').replace(/,/g, '.') : '';
            } else {
            document.getElementById('editToggleGrosir').checked = false;
            document.getElementById('editQtyBeli').value = '';
            document.getElementById('editSatuanBesar').value = '';
            document.getElementById('editIsiPerBox').value = '';
            document.getElementById('editSatuanEceran').value = '';
            document.getElementById('editModalKotor').value = '';
        }
                kalkulatorEditBatchMobile();
        
        // --- LOGIKA BARU: KUNCI SAKLAR LACI JIKA SALDO KOSONG ---
        let toggleEditLaci = document.getElementById('editPotongLaciToggle');
        if (toggleEditLaci) {
            toggleEditLaci.checked = false; // Reset selalu mati di awal
            let wadahEditLaci = toggleEditLaci.parentElement.parentElement; // Menangkap kotak wadahnya
            if (hitungSaldoLaciFisik() <= 0) {
                toggleEditLaci.disabled = true;
                if (wadahEditLaci) wadahEditLaci.classList.add('opacity-40', 'grayscale', 'pointer-events-none');
            } else {
                toggleEditLaci.disabled = false;
                if (wadahEditLaci) wadahEditLaci.classList.remove('opacity-40', 'grayscale', 'pointer-events-none');
            }
        }
        // --------------------------------------------------------
    }


function kunciFormEditMobile() {
    let formInputs = document.querySelectorAll('#panelEditMobile input:not([type="hidden"]), #panelEditMobile select');
    formInputs.forEach(input => {
        if(input.type !== 'checkbox') { input.readOnly = true; }
        input.classList.add('bg-slate-100', 'text-slate-500'); 
        input.classList.remove('bg-white', 'text-slate-800', 'bg-slate-50', 'bg-[#eef5ef]', 'text-[#274f31]');
    });
    
    let customBtns = document.querySelectorAll('#panelEditMobile .custom-dropdown-btn');
    customBtns.forEach(btn => {
        btn.disabled = true;
        btn.classList.add('bg-slate-100', 'text-slate-500');
        btn.classList.remove('bg-white', 'bg-slate-50', 'bg-[#eef5ef]', 'border-[#b2d5bb]');
    });
    
    document.getElementById('teksHeaderKunciEdit').innerHTML = '<i class="fa-solid fa-pen text-blue-300"></i> Edit Data Obat';
    document.getElementById('subTeksHeaderKunci').innerHTML = 'Mode Terkunci 🔒 (Ketuk untuk Edit)';
    document.getElementById('btnHeaderKunciEdit').classList.replace('from-amber-500', 'from-blue-600');
    document.getElementById('btnHeaderKunciEdit').classList.replace('to-orange-600', 'to-indigo-700');
    document.getElementById('btnUbahJualMobile').classList.add('hidden');
    let btnAksi = document.getElementById('btnAksiEditMobile');
    btnAksi.innerHTML = 'Tutup Layar';
    btnAksi.className = 'w-full bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-transform active:scale-95 text-sm uppercase tracking-wider';
}


function aktifkanModeEditMobile() {
    let formInputs = document.querySelectorAll('#panelEditMobile input:not([type="hidden"]), #panelEditMobile select');
    formInputs.forEach(input => {
        if(input.type !== 'checkbox') { input.readOnly = false; }
        input.classList.remove('bg-slate-100', 'text-slate-500'); 
        input.classList.add('bg-white', 'text-slate-800');
    });
    
    let customBtns = document.querySelectorAll('#panelEditMobile .custom-dropdown-btn');
    customBtns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('bg-slate-100', 'text-slate-500');
        let hiddenInput = document.getElementById(btn.id.replace('btn_', ''));
        if(hiddenInput && hiddenInput.value !== '') {
            if(btn.id.includes('Satuan')) btn.classList.add('bg-[#eef5ef]', 'border-[#b2d5bb]');
            else btn.classList.add('bg-white');
        } else {
            btn.classList.add('bg-slate-50');
        }
    });
    
    let inputJual = document.getElementById('editJualMobile');
    inputJual.readOnly = true; inputJual.classList.add('bg-slate-200', 'text-slate-500');
    document.getElementById('btnUbahJualMobile').classList.remove('hidden');
    
    document.getElementById('teksHeaderKunciEdit').innerHTML = '<i class="fa-solid fa-lock-open text-amber-200"></i> Edit Terbuka';
    document.getElementById('subTeksHeaderKunci').innerHTML = 'Mode Edit Aktif ✍️';
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

function eksekusiSimpanEditLanjutanMobile(isKulakanBaru, nBaru, vBaru, kBaru, mBaru, jBaru, sBaru, expBaru, selisihStok, riwayatAsalBaru, hppPresisi) {
    let referensi = currentEditBatchesMobile[0];
    let barang = masterItems.find(i => i.idBatch === idBatchAktif);
    
    // --- SAKLAR RESET KULAKAN BARU ---
    let qtySuntikan = isAddingNewBatchMobile ? sBaru : selisihStok;
    if (qtySuntikan > 0) {
        if (siklusAktif.isLikuidasi) {
            siklusAktif.isLikuidasi = false; 
            siklusAktif.isLanjutanDefisit = false;
            siklusAktif.hutangAwal = 0;
            siklusAktif.modalAwal = 0; siklusAktif.qtyAwal = 0; siklusAktif.uangMasuk = 0;
            siklusAktif.modalTambahan = 0; siklusAktif.qtyTambahan = 0;
        } else if (siklusAktif.isLanjutanDefisit) {
            siklusAktif.isLanjutanDefisit = false;
        }
    }
    
       if (isKulakanBaru || isAddingNewBatchMobile) {
        let nilaiSuntikanMutlak = Math.round(qtySuntikan * hppPresisi);
        
        // [PERBAIKAN BUG TAHAP 1] - LOGIKA DETEKTOR kulakan UNTUK EDIT
        let batchAda = masterItems.find(m => m.dnaInduk === referensi.dnaInduk && m.expired === expBaru);

        if (batchAda) {
            // BATCH SUDAH ADA (TGL EXP SAMA) -> Buka Kamar kulakan!
            if (!batchAda.kulakan_keuangan) batchAda.kulakan_keuangan = [];
            
            // ✅ KABEL 1 DIPERBAIKI: Mesin mencari berdasarkan hppPresisi
            let kulakanAda = batchAda.kulakan_keuangan.find(f => f.hpp === hppPresisi); 

            if (kulakanAda) {
                kulakanAda.stokAwal += qtySuntikan;
                kulakanAda.sisaGudang += qtySuntikan;
                kulakanAda.modalKeluar += nilaiSuntikanMutlak;
                
                // --- INJEKSI KABEL BARU: AKUMULASI RIWAYAT KULAKAN ---
                if (kulakanAda.riwayatAsal && riwayatAsalBaru) {
                    if (kulakanAda.riwayatAsal.satuanBesar === riwayatAsalBaru.satuanBesar && kulakanAda.riwayatAsal.isGrosir === riwayatAsalBaru.isGrosir) {
                        kulakanAda.riwayatAsal.qtyBeli += (parseFloat(riwayatAsalBaru.qtyBeli) || 0);
                    } else {
                        kulakanAda.riwayatAsal = JSON.parse(JSON.stringify(riwayatAsalBaru));
                    }
                } else {
                    kulakanAda.riwayatAsal = JSON.parse(JSON.stringify(riwayatAsalBaru));
                }
            } else {
                batchAda.kulakan_keuangan.push({
                    idkulakan: "F-" + Date.now() + Math.floor(Math.random() * 100),
                    tanggalNota: getTanggalLokal(),
                    hpp: hppPresisi, // ✅ KABEL 1 DIPERBAIKI: Simpan HPP asli, bukan pembulatan
                    stokAwal: qtySuntikan,
                    sisaGudang: qtySuntikan,
                    sisaEtalase: 0,
                    modalKeluar: nilaiSuntikanMutlak,
                    riwayatAsal: JSON.parse(JSON.stringify(riwayatAsalBaru))
                });
            }
            batchAda.stok += qtySuntikan;
            batchAda.totalModal += nilaiSuntikanMutlak;
            batchAda.modal = mBaru; 
            batchAda.riwayatAsal = riwayatAsalBaru; 
            alert("📦 Sukses! Kulakan baru telah dilebur ke dalam kulakan pada Batch yang sama.");
            
        } else {
            // BATCH BENAR-BENAR BARU
            const idBatchBaru = 'B-' + Date.now() + '-' + Math.floor(Math.random()*1000);
            masterItems.unshift({ 
                idBatch: idBatchBaru, dnaInduk: referensi.dnaInduk, barcode: referensi.barcode, qrcode: referensi.qrcode,
                nama: nBaru, varian: vBaru, keterangan: '', kategori: kBaru, modal: mBaru, jual: jBaru, stok: qtySuntikan, expired: expBaru,
                totalModal: nilaiSuntikanMutlak, riwayatAsal: riwayatAsalBaru,
                kulakan_keuangan: [{
                    idkulakan: "F-" + Date.now(), tanggalNota: getTanggalLokal(), 
                    hpp: hppPresisi, // ✅ KABEL 1 DIPERBAIKI
                    stokAwal: qtySuntikan,
                    sisaGudang: qtySuntikan, sisaEtalase: 0, modalKeluar: nilaiSuntikanMutlak,
                    riwayatAsal: JSON.parse(JSON.stringify(riwayatAsalBaru)) 
                }]
            });

                    if(!isAddingNewBatchMobile) alert("📦 Sukses! Sistem otomatis merakitkan Batch Kulakan Baru di Gudang.");
            else alert("📦 Sukses! Batch baru berhasil ditambahkan.");
        }
        
        // --- SAKLAR HIBRIDA EDIT KULAKAN ---
        let nilaiSuntikanOwner = nilaiSuntikanMutlak;
        let isPotongLaci = document.getElementById('editPotongLaciToggle') ? document.getElementById('editPotongLaciToggle').checked : false;
        if (isPotongLaci && nilaiSuntikanMutlak > 0) {
            nilaiSuntikanOwner = prosesPotongLaciOtomatis(nilaiSuntikanMutlak, `Kulakan Tambahan: ${nBaru}`);
        }
        
        siklusAktif.qtyTambahan += qtySuntikan; 
        siklusAktif.modalTambahan += nilaiSuntikanOwner; // Hanya catat uang bos
        
    } else {
        // MURNI KOREKSI DATA BATCH LAMA (EDIT BIASA, BUKAN NAMBAH KULAKAN)
        let nilaiSuntikanMutlak = Math.round(selisihStok * hppPresisi); 
        
        // --- SAKLAR HIBRIDA EDIT BIASA ---
        let nilaiSuntikanOwner = nilaiSuntikanMutlak; 
        let isPotongLaci = document.getElementById('editPotongLaciToggle') ? document.getElementById('editPotongLaciToggle').checked : false;
        if (isPotongLaci && nilaiSuntikanMutlak > 0) {
            nilaiSuntikanOwner = prosesPotongLaciOtomatis(nilaiSuntikanMutlak, `Koreksi Tambah Stok: ${barang.nama}`);
        }
        
        siklusAktif.qtyTambahan += selisihStok; 
        siklusAktif.modalTambahan += nilaiSuntikanOwner; // Hanya catat uang bos
        barang.modal = mBaru; barang.jual = jBaru; barang.stok = sBaru; barang.expired = expBaru;
        barang.totalModal = Math.round(sBaru * hppPresisi); 
        barang.riwayatAsal = riwayatAsalBaru; 
        
        // Update kulakan terakhir jika dikoreksi manual
        if (barang.kulakan_keuangan && barang.kulakan_keuangan.length > 0) {
            let fTerakhir = barang.kulakan_keuangan[barang.kulakan_keuangan.length - 1];
            fTerakhir.hpp = hppPresisi; // ✅ KABEL 1 DIPERBAIKI
            fTerakhir.sisaGudang = Math.max(0, (fTerakhir.sisaGudang || 0) + selisihStok);
            fTerakhir.stokAwal = Math.max(0, (fTerakhir.stokAwal || 0) + selisihStok);
            fTerakhir.modalKeluar = fTerakhir.stokAwal * hppPresisi; // ✅ KABEL 1 DIPERBAIKI
        }
        
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
    let nBaru = document.getElementById('editNamaMobile').value; 
    let vBaru = document.getElementById('editVarianMobile').value;
    
    let kBaru = document.getElementById('editKategoriMobile').value;
    if (kBaru === 'kustom') {
        kBaru = document.getElementById('editKategoriKustom').value.trim();
        if (!kBaru) return alert('⚠️ Kategori manual tidak boleh kosong!');
    }
    
    let mBaru = parseInt(document.getElementById('editModalMobile').value); 
    let jBaru = parseInt(document.getElementById('editJualMobile').value); 
    let sBaru = parseInt(document.getElementById('editStokMobile').value); 
    let expBaru = document.getElementById('editExpiredMobile').value;
    let satEcer = document.getElementById('editSatuanEceran').value;
    
    if(!satEcer) return alert("⚠️ Satuan Eceran wajib dipilih!");
    if(!nBaru || isNaN(mBaru) || isNaN(jBaru) || isNaN(sBaru)) return alert("Pastikan Nama dan semua Harga terisi angka yang valid!");
    if(mBaru >= jBaru) return alert("Peringatan: Harga Jual tidak boleh lebih kecil/sama dengan Harga Modal.");
    
    const isGrosir = document.getElementById('editToggleGrosir').checked;
    const qtyBeliAwal = parseFloat(document.getElementById('editQtyBeli').value) || 0;
    const satBesar = document.getElementById('editSatuanBesar').value || 'Box';
    const isiPerSatuan = parseFloat(document.getElementById('editIsiPerBox').value) || 1;
    let riwayatAsalBaru = { isGrosir: isGrosir, satuanEcer: satEcer, satuanBesar: satBesar, qtyBeli: qtyBeliAwal, isiPerBox: isiPerSatuan };

    let modalRaw = document.getElementById('editModalKotor').value.replace(/\./g, '');
    let modalKotor = parseFloat(modalRaw) || 0;
    let hppPresisi = isGrosir ? (modalKotor / (isiPerSatuan || 1)) : modalKotor;
    if (modalKotor === 0) hppPresisi = mBaru;

    let referensi = currentEditBatchesMobile[0];
    let hargaJualLama = referensi.jual;

    let barang = masterItems.find(i => i.idBatch === idBatchAktif);
    let selisihStok = isAddingNewBatchMobile ? sBaru : (sBaru - (barang ? barang.stok : 0));

    const jalankanPenyimpanan = () => {
        if (selisihStok > 0) {
            // --- MASUK KERANJANG PENAMPUNGAN (KULAKAN TAMBAH STOK) ---
            let isPotongLaci = document.getElementById('editPotongLaciToggle') ? document.getElementById('editPotongLaciToggle').checked : false;
            let tagihanMutlak = Math.round(selisihStok * hppPresisi);
            let isKulakanBaru = isAddingNewBatchMobile || ((expBaru || '') !== (barang.expired || '') || mBaru !== barang.modal);

            let itemAntrean = {
                idTunggu: 'T-' + Date.now(), sumber: 'EDIT_STOK',
                namaLengkap: nBaru + (vBaru ? ' ' + vBaru : ''),
                tagihan: tagihanMutlak, isPotongLaci: isPotongLaci, qty: selisihStok, satEcer: satEcer,
                payload: {
                    isAddingNewBatchMobile: isAddingNewBatchMobile, 
                    isKulakanBaru: isKulakanBaru, 
                    idBatchAktif: idBatchAktif,
                    dnaInduk: referensi.dnaInduk, barcode: referensi.barcode, qrcode: referensi.qrcode,
                    nBaru: nBaru, vBaru: vBaru, kBaru: kBaru, mBaru: mBaru, jBaru: jBaru, sBaru: sBaru, expBaru: expBaru, selisihStok: selisihStok, riwayatAsalBaru: riwayatAsalBaru, hppPresisi: hppPresisi, tagihanMutlak: tagihanMutlak
                }
            };

            antreanKulakan.push(itemAntrean);
            saveApotekDB('apotek_antreanKulakan', antreanKulakan);

            tutupModalMobile('modalEditMobile');
            renderBadgeAntreanKulakan();
            triggerHaptic(100);
            alert('🛒 Tambah Stok diparkir di Keranjang Kulakan!\\n(Buka troli merah di atas untuk membayar & memasukkannya ke Gudang).');
        } else {
            // --- EKSEKUSI LANGSUNG (EDIT MURNI / KOREKSI KURANGI STOK) ---
            // Tidak melibatkan uang laci karena selisihStok <= 0
            eksekusiSimpanEditLanjutanMobile(false, nBaru, vBaru, kBaru, mBaru, jBaru, sBaru, expBaru, selisihStok, riwayatAsalBaru, hppPresisi);
        }
    };

    if (jBaru !== hargaJualLama) {
        tampilkanConfirmMobile(`⚠️ PENYESUAIAN HARGA JUAL ETALASE\n\nHarga jual obat ini akan diubah menjadi ${rupiah(jBaru)}.\n\nSistem akan MENYAMAKAN harga ini untuk SELURUH stok lama agar seragam di Kasir (Satu Nyawa). HPP/Modal lama Anda dijamin aman. Lanjutkan?`, function() { jalankanPenyimpanan(); });
    } else { jalankanPenyimpanan(); }
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
// --- ASISTEN TAK KASAT MATA: PEMBELAH UANG OTOMATIS (AUTO-SPLIT) ---
function prosesPotongLaciOtomatis(tagihanMutlak, deskripsiObat) {
    let estimasiIsiLaci = hitungSaldoLaciFisik();
    let potonganLaci = 0;    
    let sisaModalOwner = tagihanMutlak; 

    const waktu = new Date(); 
    const strWaktu = waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    let keteranganLaporan = "";

    if (estimasiIsiLaci > 0) {
        potonganLaci = Math.min(estimasiIsiLaci, tagihanMutlak);
        sisaModalOwner = tagihanMutlak - potonganLaci; 

        if (sisaModalOwner > 0) {
            keteranganLaporan = `${deskripsiObat} - (Tagihan: ${rupiah(tagihanMutlak)}. Potong Laci: ${rupiah(potonganLaci)} | Dana Bos: ${rupiah(sisaModalOwner)})`;
        } else {
            keteranganLaporan = `${deskripsiObat} - (Lunas via Laci Kasir Otomatis)`;
        }
    } else {
        keteranganLaporan = `${deskripsiObat} - MURNI PAKAI DANA PRIBADI BOS (Laci Kosong)`;
    }

    pengeluaranHistory.unshift({
        id: 'OUT-AUTO-' + Date.now(),
        tanggal: getTanggalLokal(),
        waktu: strWaktu,
        kategori: 'Kulakan',
        nominal: potonganLaci, 
        keterangan: keteranganLaporan,
        kasir: 'Sistem Auto-Split'
    });
    saveApotekDB('apotek_pengeluaranHistory', pengeluaranHistory);
    return sisaModalOwner; 
}

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
function toggleKategoriKustomEditMobile() {
    const selectKategori = document.getElementById('editKategoriMobile');
    const inputKustom = document.getElementById('editKategoriKustom');
    if (selectKategori.value === 'kustom') {
        inputKustom.classList.remove('hidden');
        inputKustom.focus();
    } else {
        inputKustom.classList.add('hidden');
        inputKustom.value = ''; 
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
            teks.textContent = "Rekam"; 
        }
    });

    document.getElementById('tambahNamaMobile').value = ''; document.getElementById('tambahVarianMobile').value = '';
    
    // RESET UI DROPDOWN CUSTOM (Aman 100%)
    resetDropdownUI('tambahKategoriMobile', 'Contoh: <i>Vitamin</i>');
    resetDropdownUI('tambahSatuanEceran', 'Contoh: <i>Strip</i>');
    resetDropdownUI('tambahSatuanBesar', 'Contoh: <i>Box</i>');
    document.getElementById('tambahKategoriKustom').value = '';
    
    document.getElementById('tambahQtyBeli').value = ''; document.getElementById('tambahIsiPerSatuan').value = '';
    document.getElementById('tambahToggleBulk').checked = true;
        document.getElementById('tambahModalKotor').value = ''; document.getElementById('tambahJualEceran').value = ''; 
    document.getElementById('tambahExpiredMobile').value = '';
    
    // --- LOGIKA BARU: KUNCI SAKLAR LACI JIKA SALDO KOSONG ---
    let toggleTambahLaci = document.getElementById('tambahPotongLaciToggle');
    if (toggleTambahLaci) {
        toggleTambahLaci.checked = false; // Reset selalu mati
        let wadahTambahLaci = toggleTambahLaci.parentElement.parentElement; // Menangkap kotak wadahnya
        if (hitungSaldoLaciFisik() <= 0) {
            toggleTambahLaci.disabled = true;
            if (wadahTambahLaci) wadahTambahLaci.classList.add('opacity-40', 'grayscale', 'pointer-events-none');
        } else {
            toggleTambahLaci.disabled = false;
            if (wadahTambahLaci) wadahTambahLaci.classList.remove('opacity-40', 'grayscale', 'pointer-events-none');
        }
    }
    // --------------------------------------------------------

    document.getElementById('wadahVarianMobile').classList.add('hidden');
    document.getElementById('tambahKategoriKustom').classList.add('hidden');

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
    const varian = document.getElementById('tambahVarianMobile').value.trim(); 
    
    let kategori = document.getElementById('tambahKategoriMobile').value;
    if (kategori === 'kustom') {
        kategori = document.getElementById('tambahKategoriKustom').value.trim();
        if (!kategori) return alert('⚠️ Kategori manual tidak boleh kosong!');
    }
    
    const jualRaw = document.getElementById('tambahJualEceran').value.replace(/\./g, '');
    const jual = parseFloat(jualRaw) || 0; 
    const expired = document.getElementById('tambahExpiredMobile').value;
    
    const modal = parseFloat(document.getElementById('tambahModalKotor').dataset.calculatedHpp) || 0;
    const stok = parseFloat(document.getElementById('tambahQtyBeli').dataset.calculatedStok) || 0;
    const tagihanMutlak = parseFloat(document.getElementById('tambahQtyBeli').dataset.tagihanMutlak) || (modal * stok);
    const satEcer = document.getElementById('tambahSatuanEceran').value; 

    if(!satEcer || satEcer === "") return alert('⚠️ Satuan Eceran wajib dipilih!');
    if(!nama || !kategori || isNaN(modal) || isNaN(jual) || stok === 0) return alert('⚠️ Wajib diisi: Nama, Kategori, Jumlah, Modal, dan Jual!');
    if(modal >= jual) return alert('⚠️ Peringatan: Harga Jual Eceran harus lebih tinggi dari HPP Eceran.');
    
    const idBatch = 'B-' + Date.now(); 
    let dnaInduk = '';

    if (qrcode) { dnaInduk = qrcode; } else if (barcode) { dnaInduk = barcode; } 
    else {
        let cekGudang = masterItems.find(m => m.nama.toLowerCase() === nama.toLowerCase() && (m.varian || '').toLowerCase() === varian.toLowerCase() && (m.kategori || '').toLowerCase() === kategori.toLowerCase());
        if (cekGudang && cekGudang.dnaInduk) { dnaInduk = cekGudang.dnaInduk; } else { dnaInduk = 'DNA-' + Date.now(); }
    }

    const isBulk = document.getElementById('tambahToggleBulk').checked;
    const satBesar = document.getElementById('tambahSatuanBesar').value || 'Box';
    const qtyBeliAwal = parseFloat(document.getElementById('tambahQtyBeli').value) || 0;
    const isiPerSatuan = parseFloat(document.getElementById('tambahIsiPerSatuan').value) || 1;
    let riwayatAsal = { isGrosir: isBulk, satuanEcer: satEcer, satuanBesar: satBesar, qtyBeli: qtyBeliAwal, isiPerBox: isiPerSatuan };

    let isPotongLaci = document.getElementById('tambahPotongLaciToggle') ? document.getElementById('tambahPotongLaciToggle').checked : false;

    // --- DI PARKIR KE KERANJANG KULAKAN ---
    let itemAntrean = {
        idTunggu: 'T-' + Date.now(), sumber: 'TAMBAH_BARU',
        namaLengkap: nama + (varian ? ' ' + varian : ''),
        tagihan: tagihanMutlak, isPotongLaci: isPotongLaci, qty: stok, satEcer: satEcer,
        payload: { idBatch, dnaInduk, barcode, qrcode, nama, varian, kategori, jual, expired, modal, stok, tagihanMutlak, satEcer, riwayatAsal }
    };

    antreanKulakan.push(itemAntrean);
    saveApotekDB('apotek_antreanKulakan', antreanKulakan);

    tutupModalMobile('modalTambahObatMobile'); 
    renderBadgeAntreanKulakan();
    triggerHaptic(100);
    alert('🛒 Obat diparkir di Keranjang Kulakan!\\n(Belum masuk gudang & belum memotong uang).');
}

// ==========================================
// MESIN PEMROSES MASAL (KERANJANG KE GUDANG)
// ==========================================
function eksekusiAntreanKulakan() {
    if(antreanKulakan.length === 0) return alert('Keranjang kosong!');

    let totalTagihanPotongLaci = 0;
    let totalTagihanModalBos = 0;
    let qtyTotalSuntik = 0;
    
    antreanKulakan.forEach(item => {
        qtyTotalSuntik += item.qty;
        if(item.isPotongLaci) totalTagihanPotongLaci += item.tagihan;
        else totalTagihanModalBos += item.tagihan;

        if(item.sumber === 'TAMBAH_BARU') {
            let p = item.payload;
            let batchAda = masterItems.find(m => m.dnaInduk === p.dnaInduk && m.expired === p.expired);

            if (batchAda) {
                if (!batchAda.kulakan_keuangan) batchAda.kulakan_keuangan = [];
                let kulakanAda = batchAda.kulakan_keuangan.find(f => f.hpp === p.modal);

                if (kulakanAda) {
                    kulakanAda.stokAwal += p.stok;
                    kulakanAda.sisaGudang += p.stok;
                    kulakanAda.modalKeluar += p.tagihanMutlak;
                    if (kulakanAda.riwayatAsal && p.riwayatAsal) {
                        if (kulakanAda.riwayatAsal.satuanBesar === p.riwayatAsal.satuanBesar && kulakanAda.riwayatAsal.isGrosir === p.riwayatAsal.isGrosir) {
                            kulakanAda.riwayatAsal.qtyBeli += (parseFloat(p.riwayatAsal.qtyBeli) || 0);
                        } else { kulakanAda.riwayatAsal = JSON.parse(JSON.stringify(p.riwayatAsal)); }
                    } else { kulakanAda.riwayatAsal = JSON.parse(JSON.stringify(p.riwayatAsal)); }
                } else {
                    batchAda.kulakan_keuangan.push({ idkulakan: "F-" + Date.now() + Math.floor(Math.random()*100), tanggalNota: getTanggalLokal(), hpp: p.modal, stokAwal: p.stok, sisaGudang: p.stok, sisaEtalase: 0, modalKeluar: p.tagihanMutlak, riwayatAsal: JSON.parse(JSON.stringify(p.riwayatAsal)) });
                }
                batchAda.stok += p.stok; batchAda.totalModal += p.tagihanMutlak; batchAda.modal = p.modal; batchAda.riwayatAsal = p.riwayatAsal;
            } else {
                masterItems.unshift({ 
                    idBatch: p.idBatch, dnaInduk: p.dnaInduk, barcode: p.barcode, qrcode: p.qrcode, nama: p.nama, varian: p.varian, keterangan: '', 
                    kategori: p.kategori, modal: p.modal, jual: p.jual, stok: p.stok, expired: p.expired, totalModal: p.tagihanMutlak, riwayatAsal: p.riwayatAsal,
                    kulakan_keuangan: [{ idkulakan: "F-" + Date.now(), tanggalNota: getTanggalLokal(), hpp: p.modal, stokAwal: p.stok, sisaGudang: p.stok, sisaEtalase: 0, modalKeluar: p.tagihanMutlak, riwayatAsal: JSON.parse(JSON.stringify(p.riwayatAsal)) }]
                });
            }

            masterItems.forEach(m => { if (m.dnaInduk === p.dnaInduk) { m.jual = p.jual; m.kategori = p.kategori; } });
            let bEtalase = etalaseItems.find(e => e.dnaInduk === p.dnaInduk);
            if (bEtalase) { bEtalase.jual = p.jual; bEtalase.kategori = p.kategori; }
            
        } else if (item.sumber === 'EDIT_STOK') {
            let p = item.payload;
            if (p.isKulakanBaru || p.isAddingNewBatchMobile) {
                let batchAda = masterItems.find(m => m.dnaInduk === p.dnaInduk && m.expired === p.expBaru);

                if (batchAda) {
                    if (!batchAda.kulakan_keuangan) batchAda.kulakan_keuangan = [];
                    let kulakanAda = batchAda.kulakan_keuangan.find(f => f.hpp === p.hppPresisi);

                    if (kulakanAda) {
                        kulakanAda.stokAwal += p.selisihStok;
                        kulakanAda.sisaGudang += p.selisihStok;
                        kulakanAda.modalKeluar += p.tagihanMutlak;
                        if (kulakanAda.riwayatAsal && p.riwayatAsalBaru) {
                            if (kulakanAda.riwayatAsal.satuanBesar === p.riwayatAsalBaru.satuanBesar && kulakanAda.riwayatAsal.isGrosir === p.riwayatAsalBaru.isGrosir) {
                                kulakanAda.riwayatAsal.qtyBeli += (parseFloat(p.riwayatAsalBaru.qtyBeli) || 0);
                            } else { kulakanAda.riwayatAsal = JSON.parse(JSON.stringify(p.riwayatAsalBaru)); }
                        } else { kulakanAda.riwayatAsal = JSON.parse(JSON.stringify(p.riwayatAsalBaru)); }
                    } else {
                        batchAda.kulakan_keuangan.push({ idkulakan: "F-" + Date.now() + Math.floor(Math.random()*100), tanggalNota: getTanggalLokal(), hpp: p.hppPresisi, stokAwal: p.selisihStok, sisaGudang: p.selisihStok, sisaEtalase: 0, modalKeluar: p.tagihanMutlak, riwayatAsal: JSON.parse(JSON.stringify(p.riwayatAsalBaru)) });
                    }
                    batchAda.stok += p.selisihStok; batchAda.totalModal += p.tagihanMutlak; batchAda.modal = p.mBaru; batchAda.riwayatAsal = p.riwayatAsalBaru;
                } else {
                    const idBatchBaru = 'B-' + Date.now() + '-' + Math.floor(Math.random()*1000);
                    masterItems.unshift({ 
                        idBatch: idBatchBaru, dnaInduk: p.dnaInduk, barcode: p.barcode, qrcode: p.qrcode, nama: p.nBaru, varian: p.vBaru, keterangan: '', 
                        kategori: p.kBaru, modal: p.mBaru, jual: p.jBaru, stok: p.selisihStok, expired: p.expBaru, totalModal: p.tagihanMutlak, riwayatAsal: p.riwayatAsalBaru,
                        kulakan_keuangan: [{ idkulakan: "F-" + Date.now(), tanggalNota: getTanggalLokal(), hpp: p.hppPresisi, stokAwal: p.selisihStok, sisaGudang: p.selisihStok, sisaEtalase: 0, modalKeluar: p.tagihanMutlak, riwayatAsal: JSON.parse(JSON.stringify(p.riwayatAsalBaru)) }]
                    });
                }
            } else {
                let barang = masterItems.find(i => i.idBatch === p.idBatchAktif);
                if(barang) {
                    barang.modal = p.mBaru; barang.jual = p.jBaru; barang.stok += p.selisihStok; barang.expired = p.expBaru;
                    barang.totalModal = Math.round(barang.stok * p.hppPresisi); 
                    barang.riwayatAsal = p.riwayatAsalBaru; 
                    
                    if (barang.kulakan_keuangan && barang.kulakan_keuangan.length > 0) {
                        let fTerakhir = barang.kulakan_keuangan[barang.kulakan_keuangan.length - 1];
                        fTerakhir.hpp = p.hppPresisi; 
                        fTerakhir.sisaGudang = Math.max(0, (fTerakhir.sisaGudang || 0) + p.selisihStok);
                        fTerakhir.stokAwal = Math.max(0, (fTerakhir.stokAwal || 0) + p.selisihStok);
                        fTerakhir.modalKeluar = fTerakhir.stokAwal * p.hppPresisi; 
                    }
                }
            }

            masterItems.forEach(m => { if (m.dnaInduk === p.dnaInduk) { m.nama = p.nBaru; m.varian = p.vBaru; m.jual = p.jBaru; m.kategori = p.kBaru; } });
            let bEtalase = etalaseItems.find(e => e.dnaInduk === p.dnaInduk || e.nama === p.nBaru);
            if (bEtalase) { bEtalase.dnaInduk = p.dnaInduk; bEtalase.nama = p.nBaru; bEtalase.varian = p.vBaru; bEtalase.jual = p.jBaru; bEtalase.kategori = p.kBaru; }
        }
    });

    if (qtyTotalSuntik > 0) {
        if (siklusAktif.isLikuidasi) {
            siklusAktif.isLikuidasi = false; siklusAktif.isLanjutanDefisit = false;
            siklusAktif.hutangAwal = 0; siklusAktif.modalAwal = 0; siklusAktif.qtyAwal = 0; 
            siklusAktif.uangMasuk = 0; siklusAktif.modalTambahan = 0; siklusAktif.qtyTambahan = 0;
        } else if (siklusAktif.isLanjutanDefisit) { siklusAktif.isLanjutanDefisit = false; }
    }

    let nilaiSuntikanOwner = 0; 
    
    // 1. Eksekusi Item yang Meminta Potong Laci (Saklar Menyala)
    if (totalTagihanPotongLaci > 0) {
        nilaiSuntikanOwner = prosesPotongLaciOtomatis(totalTagihanPotongLaci, `Faktur Kulakan Kolektif (${antreanKulakan.length} Macam Obat)`);
    } 

    // 2. Eksekusi Item yang Murni Uang Bos (Saklar Mati / Tidak Dicentang)
    if (totalTagihanModalBos > 0) {
        const waktu = new Date(); 
        const strWaktu = waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        pengeluaranHistory.unshift({
            id: 'OUT-BOS-' + Date.now(),
            tanggal: getTanggalLokal(),
            waktu: strWaktu,
            kategori: 'Kulakan',
            nominal: 0, 
            keterangan: `Faktur Kulakan Gabungan - MURNI PAKAI DANA PRIBADI BOS (Saklar Dimatikan)`,
            kasir: 'Sistem'
        });
        saveApotekDB('apotek_pengeluaranHistory', pengeluaranHistory);
    }

    let totalModalSuntikan = nilaiSuntikanOwner + totalTagihanModalBos;

    if (!siklusAktif.waktuStart && siklusAktif.qtyAwal === 0 && siklusAktif.qtyTambahan === 0) { 
         siklusAktif.modalAwal += totalModalSuntikan; siklusAktif.qtyAwal += qtyTotalSuntik; 
    } else { 
         siklusAktif.modalTambahan += totalModalSuntikan; siklusAktif.qtyTambahan += qtyTotalSuntik; 
    }

    antreanKulakan = [];
    saveApotekDB('apotek_antreanKulakan', antreanKulakan);
    saveApotekDB('apotek_masterItems', masterItems); 
    saveApotekDB('apotek_siklusAktif', siklusAktif);

    tutupModalMobile('modalAntreanKulakanMobile');
    renderBadgeAntreanKulakan();
    renderGudangMobile(document.getElementById('cariGudangMobile').value); 
    renderBerandaMobile();
    triggerHaptic([100, 50, 100]);
    alert('✅ EKSKUSI FAKTUR KULAKAN SELESAI!\\nSemua obat (Obat Baru & Tambah Stok) telah diturunkan ke Gudang secara bersamaan.');
}

function bukaModalAntreanKulakan() {
    renderListAntreanKulakan();
    bukaModalMobile('modalAntreanKulakanMobile', 'panelAntreanKulakanMobile');
}

function renderListAntreanKulakan() {
    let wadah = document.getElementById('wadahListAntreanKulakan');
    let totalSemua = 0;
    if(antreanKulakan.length === 0) {
        wadah.innerHTML = `<div class="p-6 text-center text-slate-400 font-bold text-xs"><i class="fa-solid fa-box-open text-3xl mb-2 opacity-50 block"></i>Keranjang Kosong</div>`;
        document.getElementById('totalAntreanKulakan').textContent = "Rp 0";
        return;
    }
    
    wadah.innerHTML = antreanKulakan.map((item, idx) => {
        totalSemua += item.tagihan;
        let badgeLaci = item.isPotongLaci ? `<span class="text-[9px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded border border-orange-200">Potong Laci</span>` : `<span class="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">Uang Pribadi</span>`;
        return `
        <div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm mb-2 flex justify-between items-center">
            <div>
                <h4 class="font-bold text-slate-800 text-sm leading-tight mb-1">${item.namaLengkap}</h4>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black text-emerald-600">+${item.qty} ${item.satEcer}</span>
                    ${badgeLaci}
                </div>
            </div>
            <div class="flex flex-col items-end gap-2">
                <span class="font-black text-corporate-700 text-sm">${rupiah(item.tagihan)}</span>
                <button onclick="hapusItemAntrean(${idx})" class="text-[9px] font-bold text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors"><i class="fa-solid fa-trash"></i> Hapus</button>
            </div>
        </div>`;
    }).join('');
    document.getElementById('totalAntreanKulakan').textContent = rupiah(totalSemua);
}

function hapusItemAntrean(idx) {
    antreanKulakan.splice(idx, 1);
    saveApotekDB('apotek_antreanKulakan', antreanKulakan);
    renderListAntreanKulakan();
    renderBadgeAntreanKulakan();
}

function renderBadgeAntreanKulakan() {
    let badge = document.getElementById('badgeKeranjangKulakan');
    if(badge) {
        if(antreanKulakan.length > 0) {
            badge.classList.remove('hidden');
            badge.textContent = antreanKulakan.length;
        } else {
            badge.classList.add('hidden');
        }
    }
}
setTimeout(renderBadgeAntreanKulakan, 1000);


// ==========================================
// 12. MESIN KASIR & KERANJANG (POINT OF SALE)
// ==========================================
let keranjangKasirMobile = [];

function toggleDropdownKasir() { document.getElementById('dropdownKasirList').classList.toggle('hidden'); }

function pilihObatDariDropdown(dnaInduk) {
    document.getElementById('dropdownKasirList').classList.add('hidden');
    let barang = etalaseItems.find(e => e.dnaInduk === dnaInduk);
    if(barang) masukkanKeKeranjangMobile(barang);
}


function bukaModalKasirMobile() {
    keranjangKasirMobile = []; renderKeranjangMobile();
    const list = document.getElementById('dropdownKasirList');
    list.innerHTML = '';
    let adaBarang = false;
    
    etalaseItems.forEach(item => { 
        if(item.stok > 0) { 
            // SUNTIKAN: Desain elegan, varian lebih kecil & miring, kategori di bawah.
            let teksVarian = item.varian ? ` <span class="text-[9px] text-slate-400 italic font-medium ml-1 block">${item.varian}</span>` : '';
            let teksKategori = item.kategori ? ` <span class="text-[8px] uppercase font-black text-corporate-500 block">${item.kategori}</span>` : '';
            
                        list.innerHTML += `<button onclick="pilihObatDariDropdown('${item.dnaInduk}')" class="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex justify-between items-center border-b border-slate-100 last:border-0"><div class="leading-tight"><span class="font-bold text-slate-800 text-sm block">${item.nama}</span>${teksVarian}${teksKategori}</div><span class="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 shrink-0 ml-3">Sisa ${item.stok}</span></button>`; 
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
    let index = keranjangKasirMobile.findIndex(k => k.dnaInduk === barang.dnaInduk);
    if(index !== -1) {
        if(keranjangKasirMobile[index].qty < barang.stok) { 
            keranjangKasirMobile[index].qty++; 
            showToast(`✅ ${barang.nama} ditambahkan. Total di keranjang: ${keranjangKasirMobile[index].qty} stok.`);
            triggerHaptic([50, 100]);
        } else { alert("⚠️ Sisa stok " + barang.nama + " tidak cukup!"); }
    } else {
        // SUNTIKAN: Kunci dnaInduk ke keranjang agar sistem tidak salah potong
        keranjangKasirMobile.push({ dnaInduk: barang.dnaInduk, nama: barang.nama, varian: barang.varian, keterangan: barang.keterangan, kategori: barang.kategori, jual: barang.jual, qty: 1, stokMax: barang.stok });
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
        
                        let bEtalase = etalaseItems.find(e => e.dnaInduk === k.dnaInduk); 
        let totalModalItemIni = 0; 
        let sisaQtyDipotong = k.qty;

        if(bEtalase) {
            bEtalase.stok -= k.qty;
            if(bEtalase.antreanFIFO && bEtalase.antreanFIFO.length > 0) {
              for(let i = 0; i < bEtalase.antreanFIFO.length; i++) {
                    let batch = bEtalase.antreanFIFO[i];
                    if(batch.stok > 0) { 
                        let ambil = Math.min(sisaQtyDipotong, batch.stok); 
                        if (batch.totalModal !== undefined) batch.totalModal -= Math.round((ambil / batch.stok) * (batch.totalModal || 0));
                        batch.stok -= ambil; 
                        sisaQtyDipotong -= ambil; 
                        if(sisaQtyDipotong <= 0) break; 
                    }
                }
                bEtalase.antreanFIFO = bEtalase.antreanFIFO.filter(b => b.stok > 0);
            }
            
                        // [MODIFIKASI TAHAP 2] - PEMOTONGAN kulakan KEUANGAN (Sensor 3 Mata)
            let sisaPotongkulakan = k.qty;
            let masterObatTerkait = masterItems.filter(m => m.dnaInduk === k.dnaInduk);
            masterObatTerkait.sort((a, b) => new Date(a.expired || '2099-12-31') - new Date(b.expired || '2099-12-31'));

            for (let m of masterObatTerkait) {
                if (sisaPotongkulakan <= 0) break;
                if (m.kulakan_keuangan) {
                    for (let f of m.kulakan_keuangan) {
                        if (sisaPotongkulakan <= 0) break;
                        let stokTersediaDikulakan = (f.sisaEtalase || 0) + (f.sisaGudang || 0); 
                        if (stokTersediaDikulakan > 0) {
                            let ambilkulakan = Math.min(sisaPotongkulakan, stokTersediaDikulakan);
                            totalModalItemIni += (ambilkulakan * f.hpp); // Kunci Laba Murni
                            if (f.sisaEtalase >= ambilkulakan) {
                                f.sisaEtalase -= ambilkulakan;
                            } else {
                                let sisaYgGudang = ambilkulakan - (f.sisaEtalase || 0);
                                f.sisaEtalase = 0;
                                f.sisaGudang -= sisaYgGudang;
                            }
                            sisaPotongkulakan -= ambilkulakan;
                        }
                    }
                }
            }
            if (sisaPotongkulakan > 0 && masterObatTerkait.length > 0) totalModalItemIni += (sisaPotongkulakan * (masterObatTerkait[0].modal || 0));
        }
        
                    totalLaba += ((k.jual * k.qty) - totalModalItemIni);
            k.hppSatuan = Math.round(totalModalItemIni / k.qty);
            k.hppTotalModal = totalModalItemIni;
        }); // <--- INILAH PENYELAMATNYA (Penutup Loop Keranjang)

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
                        // [PERISAI MUTLAK] Cegah batal nota utama jika sudah ada cicilan
            if (!trx.isPelunasan && trx.metode === 'Debt') {
                let adaCicilan = cashierHistory.some(p => p.isPelunasan && p.idTerkait == trx.id);
                if (adaCicilan) {
                    tutupConfirmMobile();
                    return setTimeout(() => alert("⚠️ DITOLAK!\n\nNota Kasbon ini sudah memiliki riwayat pembayaran/cicilan.\nAnda harus membatalkan Bukti Pelunasannya terlebih dahulu jika ingin membatalkan nota utamanya."), 400);
                }
            }

            // [CELAH 1] LOGIKA BATAL KHUSUS PELUNASAN GABUNGAN
            if (trx.isPelunasan) {
                siklusAktif.uangMasuk -= (trx.total || 0); 
                if (siklusAktif.uangMasuk < 0) siklusAktif.uangMasuk = 0;
                
                // Bangkitkan Utang Lama dari Tali Pusar (Sistem Asisten)
                if (trx.idTerkait) {
                    let listIdUtang = trx.idTerkait.toString().split(',');
                    cashierHistory.forEach(t => {
                        if(listIdUtang.includes(t.id.toString())) {
                            t.statusLunas = false; // Kembalikan statusnya ke belum lunas
                            // Kita tidak menghapus/merestore t.item asli, karena t.item nota asli TIDAK PERNAH dikurangi.
                            // Saat Kuitansi ini dihapus, Asisten otomatis tahu bahwa cicilan batal, dan utang kembali utuh.
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
                
                                                // Kembalikan Stok ke Etalase & Suntik Ulang ke kulakan Keuangan Master (Rollback Perpetual)
                if (trx.detailKeranjang && trx.detailKeranjang.length > 0) {
                    trx.detailKeranjang.forEach(itemRetur => {
                        let qtyDiRetur = itemRetur.qty;
                        let sisaYgHarusDikembalikan = qtyDiRetur; 
                        
                                                // 1. KEMBALIKAN KE ETALASE FISIK (SIAPKAN WADAHNYA SAJA DULU)
                        let bEtalase = etalaseItems.find(i => i.dnaInduk === itemRetur.dnaInduk);
                        if (bEtalase) { 
                            bEtalase.stok += qtyDiRetur; 
                            if(!bEtalase.antreanFIFO) bEtalase.antreanFIFO = [];
                        } else {
                            bEtalase = { dnaInduk: itemRetur.dnaInduk || 'DNA-RETUR-' + Date.now(), nama: itemRetur.nama, varian: itemRetur.varian, kategori: itemRetur.kategori || 'Obat', jual: itemRetur.jual, stok: qtyDiRetur, antreanFIFO: [] };
                            etalaseItems.push(bEtalase); 
                        }


                                                // 2. OPERASI BYPASS: SUNTIK KEMBALI DENGAN MENGGUNAKAN ID BATCH ASLI (ANTI SABOTASE AUTO-HEALER)
                        let masterObatTerkait = masterItems.filter(m => m.dnaInduk === itemRetur.dnaInduk);
    masterObatTerkait.sort((a, b) => new Date(b.expired || '2099-12-31') - new Date(a.expired || '2099-12-31'));
                        
                        for (let m of masterObatTerkait) {
                            if (sisaYgHarusDikembalikan <= 0) break;
                            
                            // Suntik masuk ke dalam Perut kulakan
                            if (m.kulakan_keuangan) {
                                for (let i = m.kulakan_keuangan.length - 1; i >= 0; i--) {
                                    let f = m.kulakan_keuangan[i];
                                    if (sisaYgHarusDikembalikan <= 0) break;
                                    
                                    let sisakulakanIni = (f.sisaGudang || 0) + (f.sisaEtalase || 0);
                                    let stokAwalkulakan = f.stokAwal || sisakulakanIni;
                                    let kapasitasKosong = stokAwalkulakan - sisakulakanIni; 
                                    
                                    if (kapasitasKosong > 0) {
                                        let jumlahDikembalikan = Math.min(kapasitasKosong, sisaYgHarusDikembalikan);
                                        
                                        // A. Suntik Catatan ke Master 
                                        f.sisaEtalase = (f.sisaEtalase || 0) + jumlahDikembalikan;
                                        
                                        // B. Suntik Fisik ke Etalase FIFO dengan ID Batch yang SAMA PERSIS dengan Master
                                        let modalReturKembali = itemRetur.hppSatuan || f.hpp || (itemRetur.jual * 0.8);
                                        let batchSamaDiEtalase = bEtalase.antreanFIFO.find(x => x.idBatch === m.idBatch);
                                        
                                        if (batchSamaDiEtalase) {
                                            batchSamaDiEtalase.stok += jumlahDikembalikan;
                                            if (batchSamaDiEtalase.totalModal !== undefined) batchSamaDiEtalase.totalModal += (jumlahDikembalikan * modalReturKembali);
                                        } else {
                                            bEtalase.antreanFIFO.unshift({ 
                                                idBatch: m.idBatch, // PENTING: Gunakan ID asli, BUKAN 'RETUR-xxx'
                                                modal: modalReturKembali, 
                                                stok: jumlahDikembalikan, 
                                                expired: m.expired || '', 
                                                totalModal: (jumlahDikembalikan * modalReturKembali) 
                                            });
                                        }

                                        sisaYgHarusDikembalikan -= jumlahDikembalikan;
                                    }
                                }
                            }
                        }
                        
                        // 3. JIKA MASIH ADA SISA (Kapasitas Master Penuh/Data Kacau), BARU BUANG KE ID RETUR
                        if (sisaYgHarusDikembalikan > 0) {
                             let idBatchRetur = 'RETUR-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                             let modalReturKembali = itemRetur.hppSatuan || (itemRetur.jual * 0.8);
                             bEtalase.antreanFIFO.unshift({ idBatch: idBatchRetur, modal: modalReturKembali, stok: sisaYgHarusDikembalikan, expired: '', totalModal: (sisaYgHarusDikembalikan * modalReturKembali) });
                        }
                    });

                } else { 
                    // Fallback untuk riwayat lama (sebelum sistem keranjang)
                    let qty = trx.item || 1; let hppRetur = Math.round(((trx.total || 0) - (trx.laba || 0)) / qty);
                    etalaseItems.push({ dnaInduk: 'DNA-RETUR-OLD', nama: trx.obat, kategori: '⚠️ Barang Retur', jual: Math.round((trx.total || 0) / qty), stok: qty, antreanFIFO: [{ idBatch: 'RETUR-OLD', modal: hppRetur, stok: qty, expired: '' }] });
                }
            }
            
            // Eksekusi Pemusnahan ID dari History
            cashierHistory = cashierHistory.filter(t => t.id !== idTransaksi);

            // SIMPAN SEMUA MEMORI TERMASUK MASTER ITEMS YANG SUDAH DI-BYPASS
            saveApotekDB('apotek_masterItems', masterItems); 
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
            // SUNTIKAN: Mengambil Varian ke dalam wadah pengelompokan
            grouped[o.dnaInduk] = { dnaInduk: o.dnaInduk, nama: o.nama, varian: o.varian, kategori: o.kategori, jual: o.jual, totalStok: 0 };
        }
        grouped[o.dnaInduk].totalStok += o.stok;
    });
    
    let groupedArray = Object.values(grouped);
    list.innerHTML = groupedArray.map((g, index) => {
        // SUNTIKAN UI: Merakit Tiga Serangkai (Nama, Varian, Kategori) dengan rapi
        let teksVarian = g.varian ? `<span class="text-[9px] text-slate-400 italic font-medium ml-1.5 border-l border-slate-300 pl-1.5">${g.varian}</span>` : '';
        let teksKategori = g.kategori ? `<span class="text-[8px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded ml-2 uppercase font-bold tracking-widest inline-block -mt-0.5">${g.kategori}</span>` : '';
        
        return `
        <div class="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl shadow-sm mb-2">
            <div class="flex-1 pr-2">
                <div class="flex items-center flex-wrap mb-1 leading-tight"><span class="font-bold text-sm text-slate-800">${g.nama}</span>${teksVarian}${teksKategori}</div>
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
                
                                let barangEtalase = etalaseItems.find(e => e.dnaInduk === dnaInduk);
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
            
            // [MODIFIKASI TAHAP 2] - MIGRASI kulakan MASAL
            let sisaPindahkulakan = jumlahDiambil;
            if (batch.kulakan_keuangan) {
                for (let f of batch.kulakan_keuangan) {
                    if (sisaPindahkulakan <= 0) break;
                    if (f.sisaGudang > 0) {
                        let ambilDrkulakan = Math.min(sisaPindahkulakan, f.sisaGudang);
                        f.sisaGudang -= ambilDrkulakan;
                        f.sisaEtalase = (f.sisaEtalase || 0) + ambilDrkulakan;
                        sisaPindahkulakan -= ambilDrkulakan;
                    }
                }
            }
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
                let bEtalase = etalaseItems.find(e => e.dnaInduk === barangMaster.dnaInduk);
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
    // Kita panggil mesin eksekusi cerdas yang baru dibuat
    eksekusiPelunasanCerdas(metodePilihan);
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
                // Gambar cerdas: Hanya menggambar sisa qty aktif yang menggantung
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
    const pesanTeks = `Halo Bapak/Ibu *${nama}*, semoga hari ini sehat dan lancar selalu aktivitasnya ya. 😊\n\nKami dari *${profilApotek.nama}* memohon izin menyampaikan rincian sisa catatan kasbon yang belum diselesaikan sebesar *${rupiah(totalTagihan)}*.\n(Rincian sisa barang terlampir pada gambar struk di atas ya) 👆\n\nJika ada waktu luang, kami tunggu kedatangannya di Toko Obat kami untuk proses pelunasannya. Jangan sungkan untuk mampir kembali ya Pak/Bu kalau butuh vitamin, obat, atau sekadar periksa tensi. Kami selalu siap melayani dengan sepenuh hati! 🏥\n\nTerima kasih banyak atas kepercayaannya. Sehat dan berkah selalu! 🙏✨`;
    
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
    let saldoLaci = hitungSaldoLaciFisik();
    document.getElementById('tutupBukuSaldoAktif').textContent = rupiah(saldoLaci);
    document.getElementById('inputModalKembalian').value = '';
    
    // Menyimpan saldo aktif ke dalam tombol untuk dipanggil saat konfirmasi
    document.getElementById('btnKonfirmasiTutupBuku').dataset.saldo = saldoLaci;
    
    bukaModalMobile('modalTutupBukuMobile', 'panelTutupBukuMobile');
}

function prosesKonfirmasiTutupBuku() {
    let saldoLaci = parseInt(document.getElementById('btnKonfirmasiTutupBuku').dataset.saldo) || 0;
    let disisakanRaw = document.getElementById('inputModalKembalian').value.replace(/\./g, '');
    let disisakan = parseFloat(disisakanRaw) || 0;
    
    if (disisakan > saldoLaci) {
        return alert("⚠️ Uang kembalian yang disisakan tidak boleh lebih besar dari total fisik laci (" + rupiah(saldoLaci) + ")");
    }
    
    let uangDitarik = saldoLaci - disisakan;
    
    tampilkanConfirmMobile(`Tarik tunai ${rupiah(uangDitarik)} dan sisakan ${rupiah(disisakan)} di laci untuk besok?\n\nSetelah ini, Siklus Progress Bar akan di-reset.`, function() {
        
        // 1. EKSEKUSI AUTO-PRIVE (TARIK UANG LACI FISIK)
        if (uangDitarik > 0) {
            const waktu = new Date(); 
            const strWaktu = waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            pengeluaranHistory.unshift({
                id: 'OUT-TUTUP-' + Date.now(),
                tanggal: getTanggalLokal(),
                waktu: strWaktu,
                kategori: 'Prive',
                nominal: uangDitarik,
                keterangan: 'Tarik Tunai Laci (Tutup Buku)',
                kasir: 'Sistem'
            });
            saveApotekDB('apotek_pengeluaranHistory', pengeluaranHistory);
        }
        
        // 2. EKSEKUSI RESET PROGRESS BAR (FUNGSI ASLI)
        let targetHutangLama = (siklusAktif.hutangAwal !== undefined ? siklusAktif.hutangAwal : (siklusAktif.modalAwal || 0)) + (siklusAktif.modalTambahan || 0);
        let tercapai = siklusAktif.uangMasuk || 0;
        let sudahUntung = tercapai > targetHutangLama;
        let sisaHutang = targetHutangLama - tercapai;
        if (sisaHutang < 0) sisaHutang = 0;
        
        let asetGudangkulakan = 0; let qtyGudangkulakan = 0;
        masterItems.filter(i => i.nama !== '___SYSTEM_AUTH___' && i.kategori !== '⚠️ Barang Retur').forEach(b => { 
             asetGudangkulakan += (b.modal || 0) * (b.stok || 0); qtyGudangkulakan += (b.stok || 0); 
         });
        
        let asetEtalasekulakan = 0; let qtyEtalasekulakan = 0;
        etalaseItems.forEach(b => {
            let totalModalBatchIni = 0;
            if(b.antreanFIFO && b.antreanFIFO.length > 0) { b.antreanFIFO.forEach(f => { totalModalBatchIni += ((f.modal || 0) * (f.stok || 0)); }); } 
            else { let m = masterItems.find(x => x.dnaInduk === b.dnaInduk || x.nama === b.nama); totalModalBatchIni = (m ? (m.modal || 0) : 0) * (b.stok || 0); }
            asetEtalasekulakan += totalModalBatchIni; qtyEtalasekulakan += (b.stok || 0);
        });
        
        let totalAsetFisikSekarang = asetGudangkulakan + asetEtalasekulakan;
        let totalQtyFisikSekarang = qtyGudangkulakan + qtyEtalasekulakan;
        
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
            siklusAktif = { 
                modalAwal: totalAsetFisikSekarang, qtyAwal: totalQtyFisikSekarang, 
                modalTambahan: 0, qtyTambahan: 0, uangMasuk: 0, 
                tanggalStart: getTanggalLokal(),
                isLikuidasi: false, isLanjutanDefisit: true, hutangAwal: sisaHutang,
                waktuStart: Date.now(), snapshotStok: snapshotStok
            };
        }
        
        saveApotekDB('apotek_siklusAktif', siklusAktif);

        tutupModalMobile('modalTutupBukuMobile');
        renderBerandaMobile(); 
        
        setTimeout(() => { 
             if(sudahUntung) { alert(`✅ TUTUP BUKU BERHASIL!\nUang fisik ditarik sebesar ${rupiah(uangDitarik)}.\nMode Likuidasi Aktif.`); } 
             else { alert(`✅ TUTUP BUKU BERHASIL!\nUang fisik ditarik sebesar ${rupiah(uangDitarik)}.\nMode Defisit Lanjutan diteruskan.`); } 
         }, 500);
    });
}

// ==========================================
// MESIN KAS KELUAR (BIAYA OPERASIONAL & PRIVE)
// ==========================================
function prosesSimpanPengeluaranMobile() {
    let kategori = document.getElementById('inputKategoriPengeluaran').value;
    let nominalRaw = document.getElementById('inputNominalPengeluaran').value.replace(/\./g, '');
    let nominal = parseFloat(nominalRaw) || 0;
    let keterangan = document.getElementById('inputKetPengeluaran').value.trim();

    if (nominal <= 0) return alert("⚠️ Nominal uang keluar tidak boleh kosong!");

        // --- 🔒 MESIN GEMBOK CERDAS ANTI-MINUS ---
    // Kalkulasi Sisa Realita Laci Menggunakan Sistem Saldo Berjalan (Lintas Hari)
    let estimasiIsiLaci = hitungSaldoLaciFisik();

    // 4. Hakim Sistem Beraksi (Tolak jika minus!)

    if (nominal > estimasiIsiLaci) {
        triggerHaptic([100, 50, 100, 50]); // HP akan bergetar peringatan
        return alert(`⚠️ AKSES DITOLAK!\n\nSistem mengunci pengeluaran ini karena uang fisik di laci tidak cukup.\n\nSisa di laci: ${rupiah(estimasiIsiLaci)}\nAnda menarik: ${rupiah(nominal)}`);
    }
    // ------------------------------------------

    if (!keterangan) keterangan = kategori;

    const waktu = new Date(); 
    const strWaktu = waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    // Injeksi data ke Buku Besar Pengeluaran
    pengeluaranHistory.unshift({
        id: 'OUT-' + Date.now(),
        tanggal: getTanggalLokal(),
        waktu: strWaktu,
        kategori: kategori,
        nominal: nominal,
        keterangan: keterangan,
        kasir: 'Pemilik'
    });

    saveApotekDB('apotek_pengeluaranHistory', pengeluaranHistory);
    
        // Reset Form
    document.getElementById('inputKategoriPengeluaran').value = '';
    document.getElementById('inputNominalPengeluaran').value = '';
    document.getElementById('inputKetPengeluaran').value = '';
    
    // Kembalikan tombol kategori ke mode buram/abu-abu
    const triggerText = document.getElementById('teksPilihPengeluaran');
    const triggerBtn = document.getElementById('btnTriggerPengeluaran');
    triggerText.textContent = 'Pilih pengeluaran...';
    triggerText.classList.remove('text-slate-800');
    triggerText.classList.add('text-slate-400');
    triggerBtn.classList.remove('bg-white', 'border-rose-300', 'shadow-sm');
    triggerBtn.classList.add('bg-slate-50', 'text-slate-400', 'border-slate-200', 'shadow-inner');

    tutupModalMobile('modalPengeluaranMobile');
    renderLaporanMobile(); 
    triggerHaptic([100, 50, 100]);
    alert(`✅ Berhasil! Uang laci dipotong untuk ${kategori} senilai ${rupiah(nominal)}.`);
}


function toggleAkordeonLaporan(idElemen) {
    let el = document.getElementById(idElemen);
    let icon = document.getElementById('icon-' + idElemen);
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        if(icon) icon.style.transform = 'rotate(180deg)';
    } else {
        el.classList.add('hidden');
        if(icon) icon.style.transform = 'rotate(0deg)';
    }
}
// --- MESIN CUSTOM DROPDOWN PENGELUARAN ---
function toggleDropdownPengeluaran() {
    const menu = document.getElementById('menuKategoriPengeluaran');
    const icon = document.getElementById('iconDropdownPengeluaran');
    
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        menu.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
}

function pilihKategoriPengeluaran(nilaiKode, teksTampil) {
    // 1. Set nilai ke input tersembunyi
    document.getElementById('inputKategoriPengeluaran').value = nilaiKode;

    // 2. Ubah Teks dan Warna Tombol (Dari Buram menjadi Jelas)
    const triggerText = document.getElementById('teksPilihPengeluaran');
    const triggerBtn = document.getElementById('btnTriggerPengeluaran');

    triggerText.textContent = teksTampil;
    triggerText.classList.remove('text-slate-400');
    triggerText.classList.add('text-slate-800'); // Teks jadi gelap

    triggerBtn.classList.remove('bg-slate-50', 'text-slate-400', 'border-slate-200', 'shadow-inner');
    triggerBtn.classList.add('bg-white', 'border-rose-300', 'shadow-sm'); // Tombol jadi menonjol

    // 3. Tutup Menu
    toggleDropdownPengeluaran();
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
    tampilkanConfirmMobile("PERINGATAN BAHAYA!\n\nApakah Anda yakin ingin menghapus SEMUA DATA secara permanen? Gudang, Etalase, Riwayat, Laporan, Pengeluaran, dan Notifikasi akan dikosongkan ke posisi 0.", function() {
        
        // Memusnahkan Semua Memori Inti
        saveApotekDB('apotek_masterItems', []); 
        saveApotekDB('apotek_etalaseItems', []); 
        saveApotekDB('apotek_cashierHistory', []);
        saveApotekDB('apotek_siklusAktif', { modalAwal: 0, qtyAwal: 0, modalTambahan: 0, qtyTambahan: 0, uangMasuk: 0, tanggalStart: getTanggalLokal() });
        
        // --- TAMBALAN BARU: Memusnahkan Pengeluaran & Notifikasi ---
        saveApotekDB('apotek_pengeluaranHistory', []);
        saveApotekDB('apotek_notifikasi', []);
        // -----------------------------------------------------------
        
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
            let kunci = m.dnaInduk; let namaLengkap = m.nama + (m.varian ? ` ${m.varian}` : '');
            if(!gabungan[kunci]) gabungan[kunci] = { nama: namaLengkap, modal: m.modal, jual: m.jual, qty: 0 };
            gabungan[kunci].qty += m.stok;
        }});
        etalaseItems.forEach(e => {
            let kunci = e.dnaInduk || e.nama; let namaLengkap = e.nama + (e.varian ? ` ${e.varian}` : '');
            if(!gabungan[kunci]) gabungan[kunci] = { nama: namaLengkap, modal: (e.antreanFIFO && e.antreanFIFO[0]?.modal) || 0, jual: e.jual, qty: 0 };
            gabungan[kunci].qty += e.stok;
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
                    let kunci = item.dnaInduk || item.nama;
                    let namaLengkap = item.nama + (item.varian ? ` ${item.varian}` : '');
                    if(!targetGroup[kunci]) targetGroup[kunci] = { nama: namaLengkap, modal: item.hppSatuan || (item.jual*0.8), jual: item.jual, qty: 0 };
                    targetGroup[kunci].qty += item.qty;
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
        judul.textContent = "Total Keseluruhan Stok"; subJudul.textContent = "Sisa Stok + Terjual";
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
    let dataPeriode = cashierHistory.filter(t => t.tanggal >= laporanTglAwal && t.tanggal <= laporanTglAkhir);
    let dataKeluar = pengeluaranHistory.filter(p => p.tanggal >= laporanTglAwal && p.tanggal <= laporanTglAkhir);


    if(dataPeriode.length === 0 && dataKeluar.length === 0) return alert("Data kosong! Belum ada transaksi pada rentang tanggal ini.");
    
    // 1. Kalkulasi Laba / Rugi (Income Statement)
    let lOmset = 0, lHPP = 0, omzetTunai = 0, omzetQRIS = 0, omzetDebt = 0;
    let htmlTabel = ""; let urut = 1;

    dataPeriode.forEach(t => {
        let hpp = 0, omzet = 0, laba = 0;
        let qty = t.item, namaObat = t.obat;

        if(!t.isPelunasan) {
            omzet = t.total; laba = t.laba; hpp = (t.total - t.laba);
            lOmset += omzet; lHPP += hpp;
            if(t.metode === 'Tunai') omzetTunai += omzet;
            else if(t.metode === 'QRIS') omzetQRIS += omzet;
            else if(t.metode === 'Debt') omzetDebt += omzet;
        } else {
            qty = "-"; namaObat = "PELUNASAN KASBON (" + (t.pelanggan || 'Pelanggan') + ")";
            omzet = t.total; 
        }

        htmlTabel += `
            <tr>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${urut++}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${t.tanggal} ${t.waktu}</td>
                <td style="border: 1px solid #000; padding: 4px;">${namaObat}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${qty}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: center;">${t.metode}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: right; font-family: monospace;">${hpp > 0 ? rupiah(hpp) : '-'}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: right; font-family: monospace;">${rupiah(omzet)}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: right; font-family: monospace;">${laba > 0 ? rupiah(laba) : '-'}</td>
            </tr>`;
    });

    let bBiayaToko = 0;
    dataKeluar.forEach(p => { if (p.kategori === 'Biaya Toko') bBiayaToko += p.nominal; });
    let labaBersihSejati = (lOmset - lHPP) - bBiayaToko;

    // 2. Kalkulasi Neraca Kekayaan Lintas Waktu (Balance Sheet)
    let estimasiIsiLaci = hitungSaldoLaciFisik(); 
    let hartaQRIS = 0, hartaPiutang = 0, hutangMap = {};
    
    cashierHistory.forEach(t => {
        if(t.metode === 'QRIS' && !t.isPelunasan) hartaQRIS += (t.total || 0);
        if(t.isPelunasan && (t.metodeBayar === 'QRIS' || t.metodeBayar === 'qris' || t.metode === 'QRIS')) hartaQRIS += (t.total || 0);
        
        if(t.metode === 'Debt' || t.isPelunasan) {
            if(t.metode === 'Debt' && !t.statusLunas) hutangMap[t.id] = t.total;
            if(t.isPelunasan && t.idTerkait && hutangMap[t.idTerkait]) hutangMap[t.idTerkait] -= t.total;
        }
    });
    Object.values(hutangMap).forEach(v => { if(v > 0) hartaPiutang += v; });

    let sisaQtyReal = 0, sisaRpReal = 0;
    masterItems.filter(i => i.nama !== '___SYSTEM_AUTH___' && i.kategori !== '⚠️ Barang Retur').forEach(b => { 
        sisaQtyReal += (b.stok || 0); sisaRpReal += (b.totalModal !== undefined ? b.totalModal : (b.modal * b.stok)); 
    });
    etalaseItems.forEach(b => {
        sisaQtyReal += (b.stok || 0);
        if(b.antreanFIFO && b.antreanFIFO.length > 0) { b.antreanFIFO.forEach(f => sisaRpReal += (f.totalModal !== undefined ? f.totalModal : (f.modal * f.stok))); } 
        else { let m = masterItems.find(x => x.dnaInduk === b.dnaInduk || x.nama === b.nama); sisaRpReal += (m ? (m.modal || 0) : 0) * (b.stok || 0); }
    });

    // 3. Kalkulasi Persediaan
    let terjualQtySiklus = 0, terjualRpSiklus = 0;
    let wMulai = siklusAktif.waktuStart || 0;
    cashierHistory.filter(t => (wMulai ? t.id >= wMulai : t.tanggal >= siklusAktif.tanggalStart) && !t.isPelunasan).forEach(t => {
        terjualQtySiklus += (t.item || 1); terjualRpSiklus += ((t.total || 0) - (t.laba || 0));
    });
    let totalQtyTersedia = (siklusAktif.qtyAwal || 0) + (siklusAktif.qtyTambahan || 0);
    let totalModalTersedia = (siklusAktif.modalAwal || 0) + (siklusAktif.modalTambahan || 0);

    let dNow = new Date();
    let strWaktuCetak = dNow.toLocaleDateString('id-ID') + " " + dNow.toLocaleTimeString('id-ID');

    // --- HTML WORD CONSTRUCTION ---
    let header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>";
    header += "<head><meta charset='utf-8'><title>Buku Besar Apotek</title>";
    header += `
    <style>
        @page WordSection1 { size: 841.95pt 595.35pt; mso-page-orientation: landscape; margin: 1cm; }
        div.WordSection1 { page: WordSection1; font-family: 'Arial', sans-serif; font-size: 10pt; color: #000; }
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #e0e0e0; color: #000; border: 1px solid #000; padding: 6px; font-weight: bold; text-align: center; }
        td { border: 1px solid #000; padding: 4px; }
        .title { text-align: left; font-size: 18pt; font-weight: bold; text-transform: uppercase; margin-bottom: 2px;}
        .subtitle { text-align: left; font-size: 10pt; font-weight: bold; margin-bottom: 15px; }
        .info-table { border: none; margin-bottom: 15px; width: 60%; }
        .info-table td { border: none; padding: 2px; }
        .ledger-box { border: 1px solid #000; padding: 8px; vertical-align: top; }
        .l-title { font-weight: bold; background: #e0e0e0; text-align: center; padding: 4px; border-bottom: 1px solid #000; margin-bottom: 5px; text-transform: uppercase;}
        .r-val { text-align: right; font-family: monospace; font-weight: bold; }
    </style>
    </head><body><div class='WordSection1'>
    `;

    let content = `
    <div class="title">${profilApotek.nama}</div>
    <div class="subtitle">Buku Besar & Neraca Keuangan Komprehensif</div>

    <table class="info-table">
        <tr><td width="15%"><b>Periode</b></td><td width="35%">: ${laporanLabelVisual}</td><td width="15%"><b>Kasir</b></td><td width="35%">: Sistem Laporan</td></tr>
        <tr><td><b>Dicetak</b></td><td>: ${strWaktuCetak}</td><td><b>Trx</b></td><td>: ${urut - 1} Nota</td></tr>
    </table>

    <h3 style="font-size: 11pt; margin-bottom: 5px; text-transform: uppercase; border-bottom:1px solid #000;">A. Rincian Buku Harian Transaksi</h3>
    <table style="margin-bottom: 20px;">
        <thead>
            <tr><th width="4%">No</th><th width="12%">Waktu</th><th width="28%">Nama Obat / Keterangan</th><th width="6%">Qty</th><th width="10%">Metode</th><th width="13%">HPP Keluar</th><th width="13%">Omzet</th><th width="14%">Laba Kotor</th></tr>
        </thead>
        <tbody>${htmlTabel}</tbody>
    </table>

    <table style="width: 100%; border: none; margin-top: 10px;">
        <tr>
            <!-- BLOK I -->
            <td width="32%" class="ledger-box">
                <div class="l-title">I. Alur Modal Persediaan</div>
                <table style="border:none; width:100%;">
                    <tr><td style="border:none; padding:2px;">Modal Awal / Titik Nol</td><td class="r-val" style="border:none; padding:2px;">${siklusAktif.qtyAwal} Pcs</td></tr>
                    <tr><td style="border:none; padding:2px;"></td><td class="r-val" style="border:none; padding:2px;">${rupiah(siklusAktif.modalAwal)}</td></tr>
                    <tr><td style="border:none; padding:2px;">(+) Suntikan Kulakan</td><td class="r-val" style="border:none; padding:2px;">${siklusAktif.qtyTambahan} Pcs</td></tr>
                    <tr><td style="border:none; padding:2px; border-bottom: 1px solid #000;"></td><td class="r-val" style="border:none; padding:2px; border-bottom: 1px solid #000;">${rupiah(siklusAktif.modalTambahan)}</td></tr>
                    <tr><td style="border:none; padding:2px; font-weight:bold;">Sedia Dijual</td><td class="r-val" style="border:none; padding:2px;">${rupiah(totalModalTersedia)}</td></tr>
                    <tr><td style="border:none; padding:2px;">(-) Terjual (HPP)</td><td class="r-val" style="border:none; padding:2px;">${terjualQtySiklus} Pcs</td></tr>
                    <tr><td style="border:none; padding:2px; border-bottom: 1px solid #000;"></td><td class="r-val" style="border:none; padding:2px; border-bottom: 1px solid #000;">${rupiah(terjualRpSiklus)}</td></tr>
                    <tr><td style="border:none; padding:4px 2px; font-weight:bold;">ASET RAK SISA</td><td class="r-val" style="border:none; padding:4px 2px;">${rupiah(sisaRpReal)}</td></tr>
                </table>
            </td>
            <td width="2%" style="border:none;"></td>
            <!-- BLOK II -->
            <td width="32%" class="ledger-box">
                <div class="l-title">II. Kinerja Laba Rugi</div>
                <table style="border:none; width:100%;">
                    <tr><td style="border:none; padding:2px;">Omzet Tunai</td><td class="r-val" style="border:none; padding:2px;">${rupiah(omzetTunai)}</td></tr>
                    <tr><td style="border:none; padding:2px;">Omzet QRIS</td><td class="r-val" style="border:none; padding:2px;">${rupiah(omzetQRIS)}</td></tr>
                    <tr><td style="border:none; padding:2px; border-bottom: 1px solid #000;">Omzet Piutang</td><td class="r-val" style="border:none; padding:2px; border-bottom: 1px solid #000;">${rupiah(omzetDebt)}</td></tr>
                    <tr><td style="border:none; padding:2px; font-weight:bold;">Total Omzet</td><td class="r-val" style="border:none; padding:2px;">${rupiah(lOmset)}</td></tr>
                    <tr><td style="border:none; padding:2px;">(-) HPP Keluar</td><td class="r-val" style="border:none; padding:2px;">${rupiah(lHPP)}</td></tr>
                    <tr><td style="border:none; padding:2px; border-bottom: 1px solid #000;">(-) Biaya Toko</td><td class="r-val" style="border:none; padding:2px; border-bottom: 1px solid #000;">${rupiah(bBiayaToko)}</td></tr>
                    <tr><td style="border:none; padding:4px 2px; font-weight:bold;">LABA BERSIH</td><td class="r-val" style="border:none; padding:4px 2px;">${rupiah(labaBersihSejati)}</td></tr>
                </table>
            </td>
            <td width="2%" style="border:none;"></td>
            <!-- BLOK III -->
            <td width="32%" class="ledger-box">
                <div class="l-title">III. Neraca Kekayaan</div>
                <table style="border:none; width:100%;">
                    <tr><td style="border:none; padding:2px;">1. Harta Tunai Laci</td><td class="r-val" style="border:none; padding:2px;">${rupiah(estimasiIsiLaci)}</td></tr>
                    <tr><td style="border:none; padding:2px;">2. Harta Bank QRIS</td><td class="r-val" style="border:none; padding:2px;">${rupiah(hartaQRIS)}</td></tr>
                    <tr><td style="border:none; padding:2px;">3. Harta Piutang</td><td class="r-val" style="border:none; padding:2px;">${rupiah(hartaPiutang)}</td></tr>
                    <tr><td style="border:none; padding:2px; border-bottom: 1px solid #000;">4. Harta Stok Barang</td><td class="r-val" style="border:none; padding:2px; border-bottom: 1px solid #000;">${rupiah(sisaRpReal)}</td></tr>
                    <tr><td style="border:none; padding:4px 2px; font-weight:bold;">TOTAL ASET KESELURUHAN</td><td class="r-val" style="border:none; padding:4px 2px;">${rupiah(estimasiIsiLaci + hartaQRIS + hartaPiutang + sisaRpReal)}</td></tr>
                </table>
            </td>
        </tr>
    </table>
    `;

    let footer = "</div></body></html>";
    let fullHTML = header + content + footer;

    let blob = new Blob(['\ufeff', fullHTML], { type: 'application/msword' });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "BukuBesar_" + laporanLabelVisual.replace(/\s/g, '_') + ".doc";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    alert("✅ File Laporan Word berhasil diunduh ke perangkat Anda!");
}

// ==========================================
// MESIN CETAK LAPORAN KE PDF (A4 LANDSCAPE STRICT LEDGER)
// ==========================================
function exportLaporanKePDF() {
    let dataPeriode = cashierHistory.filter(t => t.tanggal >= laporanTglAwal && t.tanggal <= laporanTglAkhir);
    let dataKeluar = pengeluaranHistory.filter(p => p.tanggal >= laporanTglAwal && p.tanggal <= laporanTglAkhir);


    if(dataPeriode.length === 0 && dataKeluar.length === 0) return alert("Data kosong! Belum ada transaksi pada rentang tanggal ini.");

    // 1. Kalkulasi Laba / Rugi (Income Statement)
    let lOmset = 0, lHPP = 0, omzetTunai = 0, omzetQRIS = 0, omzetDebt = 0;
    let isiTabelHTML = ""; let urut = 1;

    dataPeriode.forEach(t => {
        let hpp = 0, omzet = 0, laba = 0;
        let qty = t.item, namaObat = t.obat;

        if(!t.isPelunasan) {
            omzet = t.total; laba = t.laba; hpp = (t.total - t.laba);
            lOmset += omzet; lHPP += hpp;
            if(t.metode === 'Tunai') omzetTunai += omzet;
            else if(t.metode === 'QRIS') omzetQRIS += omzet;
            else if(t.metode === 'Debt') omzetDebt += omzet;
        } else {
            qty = "-"; namaObat = "PELUNASAN KASBON (" + (t.pelanggan || 'Pelanggan') + ")";
            omzet = t.total; 
        }

        isiTabelHTML += `
            <tr>
                <td class="text-center">${urut++}</td>
                <td class="text-center">${t.tanggal} ${t.waktu}</td>
                <td>${namaObat}</td>
                <td class="text-center">${qty}</td>
                <td class="text-center">${t.metode}</td>
                <td class="text-right t-num">${hpp > 0 ? rupiah(hpp) : '-'}</td>
                <td class="text-right t-num">${rupiah(omzet)}</td>
                <td class="text-right t-num">${laba > 0 ? rupiah(laba) : '-'}</td>
            </tr>`;
    });

    let bBiayaToko = 0;
    dataKeluar.forEach(p => { if (p.kategori === 'Biaya Toko') bBiayaToko += p.nominal; });
    let labaBersihSejati = (lOmset - lHPP) - bBiayaToko;

    // 2. Kalkulasi Neraca Kekayaan Lintas Waktu (Balance Sheet)
    let estimasiIsiLaci = hitungSaldoLaciFisik(); 
    let hartaQRIS = 0, hartaPiutang = 0, hutangMap = {};
    
    cashierHistory.forEach(t => {
        if(t.metode === 'QRIS' && !t.isPelunasan) hartaQRIS += (t.total || 0);
        if(t.isPelunasan && (t.metodeBayar === 'QRIS' || t.metodeBayar === 'qris' || t.metode === 'QRIS')) hartaQRIS += (t.total || 0);
        
        if(t.metode === 'Debt' || t.isPelunasan) {
            if(t.metode === 'Debt' && !t.statusLunas) hutangMap[t.id] = t.total;
            if(t.isPelunasan && t.idTerkait && hutangMap[t.idTerkait]) hutangMap[t.idTerkait] -= t.total;
        }
    });
    Object.values(hutangMap).forEach(v => { if(v > 0) hartaPiutang += v; });

    let sisaQtyReal = 0, sisaRpReal = 0;
    masterItems.filter(i => i.nama !== '___SYSTEM_AUTH___' && i.kategori !== '⚠️ Barang Retur').forEach(b => { 
        sisaQtyReal += (b.stok || 0); sisaRpReal += (b.totalModal !== undefined ? b.totalModal : (b.modal * b.stok)); 
    });
    etalaseItems.forEach(b => {
        sisaQtyReal += (b.stok || 0);
        if(b.antreanFIFO && b.antreanFIFO.length > 0) { b.antreanFIFO.forEach(f => sisaRpReal += (f.totalModal !== undefined ? f.totalModal : (f.modal * f.stok))); } 
        else { let m = masterItems.find(x => x.dnaInduk === b.dnaInduk || x.nama === b.nama); sisaRpReal += (m ? (m.modal || 0) : 0) * (b.stok || 0); }
    });

    // 3. Kalkulasi Persediaan
    let terjualQtySiklus = 0, terjualRpSiklus = 0;
    let wMulai = siklusAktif.waktuStart || 0;
    cashierHistory.filter(t => (wMulai ? t.id >= wMulai : t.tanggal >= siklusAktif.tanggalStart) && !t.isPelunasan).forEach(t => {
        terjualQtySiklus += (t.item || 1); terjualRpSiklus += ((t.total || 0) - (t.laba || 0));
    });
    let totalQtyTersedia = (siklusAktif.qtyAwal || 0) + (siklusAktif.qtyTambahan || 0);
    let totalModalTersedia = (siklusAktif.modalAwal || 0) + (siklusAktif.modalTambahan || 0);

    // --- SUNTIK DATA KE DOM HTML CETAK ---
    let dNow = new Date();
    document.getElementById('p-waktu-cetak').innerText = dNow.toLocaleDateString('id-ID') + " " + dNow.toLocaleTimeString('id-ID');
    document.getElementById('p-nama-apotek').innerText = profilApotek.nama.toUpperCase();
    document.getElementById('p-owner').innerText = profilApotek.nama;
    document.getElementById('p-tgl').innerText = laporanLabelVisual;
    document.getElementById('p-trx').innerText = (urut - 1) + " Nota";

    // Tabel Trx
    document.getElementById('p-tabel-body').innerHTML = isiTabelHTML;
    document.getElementById('p-tot-hpp').innerText = rupiah(lHPP);
    document.getElementById('p-tot-omzet').innerText = rupiah(lOmset); // Total omzet kotor tanpa pelunasan
    document.getElementById('p-tot-laba').innerText = rupiah(lOmset - lHPP);

    // BLOK 1
    document.getElementById('p-qty-awal').innerText = siklusAktif.qtyAwal + " Pcs";
    document.getElementById('p-rp-awal').innerText = rupiah(siklusAktif.modalAwal);
    document.getElementById('p-qty-tambah').innerText = siklusAktif.qtyTambahan + " Pcs";
    document.getElementById('p-rp-tambah').innerText = rupiah(siklusAktif.modalTambahan);
    document.getElementById('p-rp-siap').innerText = rupiah(totalModalTersedia);
    document.getElementById('p-qty-jual').innerText = terjualQtySiklus + " Pcs";
    document.getElementById('p-rp-jual').innerText = rupiah(terjualRpSiklus);
    document.getElementById('p-rp-akhir').innerText = rupiah(sisaRpReal);

    // BLOK 2
    document.getElementById('p-omzet-tunai').innerText = rupiah(omzetTunai);
    document.getElementById('p-omzet-qris').innerText = rupiah(omzetQRIS);
    document.getElementById('p-omzet-debt').innerText = rupiah(omzetDebt);
    document.getElementById('p-omzet-total').innerText = rupiah(lOmset);
    document.getElementById('p-beban-hpp').innerText = rupiah(lHPP);
    document.getElementById('p-beban-biaya').innerText = rupiah(bBiayaToko);
    document.getElementById('p-laba-bersih').innerText = rupiah(labaBersihSejati);

    // BLOK 3
    document.getElementById('p-harta-tunai').innerText = rupiah(estimasiIsiLaci);
    document.getElementById('p-harta-qris').innerText = rupiah(hartaQRIS);
    document.getElementById('p-harta-piutang').innerText = rupiah(hartaPiutang);
    document.getElementById('p-harta-barang').innerText = rupiah(sisaRpReal);
    document.getElementById('p-harta-total').innerText = rupiah(estimasiIsiLaci + hartaQRIS + hartaPiutang + sisaRpReal);

    // Cetak
    setTimeout(() => { window.print(); }, 300);
}


// ==========================================
// MESIN KALKULATOR KONVERSI EDIT BATCH
// ==========================================
function kalkulatorEditBatchMobile() {
    let isGrosir = document.getElementById('editToggleGrosir') ? document.getElementById('editToggleGrosir').checked : false;
    let jumlahBeli = parseFloat(document.getElementById('editQtyBeli').value) || 0;
    let isiPerBox = parseFloat(document.getElementById('editIsiPerBox').value) || 1;
    
    let modalRaw = document.getElementById('editModalKotor').value.replace(/\./g, '');
    let modalKotor = parseFloat(modalRaw) || 0;

    let satEcer = document.getElementById('editSatuanEceran').value || 'Pcs';
    let satBesar = document.getElementById('editSatuanBesar').value || 'Box';

    let wadahGrosir = document.getElementById('wadahIsiPerBoxEdit');
    let labelModalKotor = document.getElementById('labelModalKotorEdit');
    let labelMultiplier = document.getElementById('labelMultiplierEdit');
    const knob = document.querySelector('#editToggleGrosir ~ label .toggle-knob');

    if(isGrosir) { 
        if(wadahGrosir) wadahGrosir.classList.remove('hidden'); 
        if(labelMultiplier) labelMultiplier.textContent = `1 ${satBesar} isi brp ${satEcer}?`;
        if(labelModalKotor) labelModalKotor.textContent = `Modal Beli (per ${satBesar})`;
        if(knob) knob.style.transform = 'translateX(20px)';
    } else { 
        if(wadahGrosir) { wadahGrosir.classList.add('hidden'); isiPerBox = 1; }
        if(labelModalKotor) labelModalKotor.textContent = `Modal Beli (per ${satEcer})`;
        if(knob) knob.style.transform = 'translateX(0px)';
    }

    let totalStokEceran = isGrosir ? (jumlahBeli * isiPerBox) : jumlahBeli;
    let hppEceran = isGrosir ? (modalKotor / (isiPerBox || 1)) : modalKotor;

    let inputStok = document.getElementById('editStokMobile');
    let inputModal = document.getElementById('editModalMobile');

    if(inputStok && jumlahBeli > 0) inputStok.value = totalStokEceran;
    if(inputModal && modalKotor > 0) inputModal.value = Math.round(hppEceran);

    let infoText = document.getElementById('infoKalkulasiEdit');
    if(infoText) {
        if(jumlahBeli > 0 || modalKotor > 0) {
            infoText.innerHTML = `Otomatis Hitung: Masuk <b class="text-emerald-600">${totalStokEceran} ${satEcer}</b> | HPP: <b class="text-red-500">${rupiah(Math.round(hppEceran))}</b> / ${satEcer}`;
        } else {
            infoText.innerHTML = `Nyalakan saklar jika beli dlm bentuk Grosir (Box/Dos)`;
        }
    }
}

// ==========================================
// MESIN POP-UP DETAIL OBAT (MASTER GUDANG)
// ==========================================
function bukaDetailObatMobile(dnaInduk) {
    let batches = masterItems.filter(i => i.dnaInduk === dnaInduk);
    if (batches.length === 0) return;
    
    batches.sort((a, b) => a.idBatch.localeCompare(b.idBatch));
    let referensi = batches[batches.length - 1];

    // --- 🩺 MESIN PENYELARAS (AUTO-HEALER) kulakan KEUANGAN ---
    // Menyelaraskan data masa lalu yang tersangkut agar sinkron 100% dengan fisik
    batches.forEach(b => {
        let bEtalase = etalaseItems.find(e => e.dnaInduk === dnaInduk || e.nama === b.nama);
        let stokEtalaseFisik = 0;
        if (bEtalase && bEtalase.antreanFIFO) {
            let fEtalase = bEtalase.antreanFIFO.find(x => x.idBatch === b.idBatch);
            if (fEtalase) stokEtalaseFisik = parseInt(fEtalase.stok) || 0;
        }

        if (b.kulakan_keuangan) {
            let sisaEtalaseTersedia = stokEtalaseFisik;
            
            b.kulakan_keuangan.forEach(f => {
                let totalKapasitaskulakan = parseInt(f.sisaGudang || 0) + parseInt(f.sisaEtalase || 0);
                
                if (sisaEtalaseTersedia >= totalKapasitaskulakan) {
                    f.sisaEtalase = totalKapasitaskulakan;
                    f.sisaGudang = 0;
                    sisaEtalaseTersedia -= totalKapasitaskulakan;
                } else {
                    f.sisaEtalase = sisaEtalaseTersedia;
                    f.sisaGudang = totalKapasitaskulakan - sisaEtalaseTersedia;
                    sisaEtalaseTersedia = 0;
                }
            });
        }
    });
    saveApotekDB('apotek_masterItems', masterItems);
    // -------------------------------------------------------
    
    document.getElementById('detailObatNamaTitle').textContent = referensi.nama.toUpperCase();
    
    // VARIABEL AKUMULASI NERACA MIKRO (HELIKOPTER VIEW)
    let totalStokKeseluruhan = 0;
    let totalModalTertanamKeseluruhan = 0;
    let totalModalDikeluarkanKeseluruhan = 0;
    let htmlBatches = '';
    
    batches.forEach((b, indexBatch) => {
        let listkulakan = b.kulakan_keuangan || [{
            idkulakan: "F-MIGRASI", tanggalNota: b.riwayatAsal ? 'Data Awal' : '-', hpp: b.modal, stokAwal: b.stok, sisaGudang: b.stok, sisaEtalase: 0, modalKeluar: (b.totalModal !== undefined ? b.totalModal : (b.modal * b.stok))
        }];
        
        // VARIABEL SIKLUS MODAL PERPETUAL (PER BATCH)
        let sisaStokBatchIni = 0;
        let terjualBatchIni = 0;
        let totalModalBatch = 0;
        let modalTertanamBatch = 0;
        
        let pendapatanBatchIni = 0;
        let hppKeluarBatchIni = 0;
        let labaBatchIni = 0;

        let htmlkulakan = '';
        
        listkulakan.forEach((f, indexkulakan) => {
            let sisaGudang = f.sisaGudang || 0;
            let sisaEtalase = f.sisaEtalase || 0;
            let sisakulakanIni = sisaGudang + sisaEtalase;
            let stokAwalkulakan = f.stokAwal || sisakulakanIni; 
            let hppkulakan = f.hpp || 0;
            
            let terjualkulakan = stokAwalkulakan - sisakulakanIni;
            if (terjualkulakan < 0) terjualkulakan = 0;
            
            // KALKULASI FINANSIAL SPESIFIK kulakan INI
            let totalModalkulakanIni = stokAwalkulakan * hppkulakan;
            let omsetkulakan = terjualkulakan * referensi.jual;
            let hppKeluarkulakan = terjualkulakan * hppkulakan;
            let labakulakan = omsetkulakan - hppKeluarkulakan;

            // AKUMULASI KE BATCH
            sisaStokBatchIni += sisakulakanIni;
            terjualBatchIni += terjualkulakan;
            totalModalBatch += totalModalkulakanIni; 
            modalTertanamBatch += (sisakulakanIni * hppkulakan); 
            
            pendapatanBatchIni += omsetkulakan;
            hppKeluarBatchIni += hppKeluarkulakan;
            labaBatchIni += labakulakan;
            
                        // RENDERING HEADER KULAKAN kulakan (DESAIN GRID 5 KOLOM SEJAJAR & ANTI-TURUN BARIS)
            let riwayat = f.riwayatAsal || b.riwayatAsal; 
            let htmlKulakankulakan = '';
            
            if(riwayat) {
                let namaSatuan = riwayat.satuanEcer || 'Pcs';
                if(riwayat.isGrosir) {
                    let hargaPerBox = hppkulakan * riwayat.isiPerBox;
                    htmlKulakankulakan = `
                    <div class="bg-indigo-50/40 border-b border-indigo-100/60 p-3.5">
                        <!-- Header Tanpa Ikon (Ruang Diperlebar) -->
                        <div class="flex flex-col mb-3">
                            <p class="text-[12px] font-black text-indigo-900 uppercase tracking-widest leading-none">KULAKAN GROSIR</p>
                            <p class="text-[10px] font-bold text-slate-600 uppercase tracking-wide mt-1 flex flex-wrap gap-1">
                                Pembelian: ${riwayat.qtyBeli} ${riwayat.satuanBesar} <span class="text-indigo-300">|</span> <span>@ ${riwayat.isiPerBox} ${namaSatuan}</span>
                            </p>
                        </div>
                        
                        <!-- Box Detail Harga (Grid 5 Kolom: Rata Presisi Titik Dua, Rp, & Angka) -->
                        <div class="bg-white border border-indigo-100/50 rounded-xl p-3.5 shadow-[0px_2px_10px_-3px_rgba(0,0,0,0.06)] overflow-hidden">
                            <div class="grid grid-cols-[max-content_max-content_1fr_max-content_max-content] gap-x-1.5 items-center w-full text-[10px] whitespace-nowrap">
                                
                                <!-- BARIS 1: HARGA DOS -->
                                <div class="font-bold text-indigo-900 uppercase tracking-wide">Harga / ${riwayat.satuanBesar}</div>
                                <div class="font-black text-indigo-900">:</div>
                                <div class="w-full"></div>
                                <div class="font-bold text-indigo-900">Rp</div>
                                <div class="font-black text-indigo-900 text-right text-[12px] sm:text-[14px] tracking-tight">${Math.round(hargaPerBox).toLocaleString('id-ID')}</div>
                                
                                <!-- BARIS 2: MODAL BELI kulakan -->
                                <div class="font-bold text-indigo-900 uppercase tracking-wide mt-3">Modal Beli kulakan</div>
                                <div class="font-black text-indigo-900 mt-3">:</div>
                                <div class="w-full mt-3"></div>
                                <div class="font-bold text-indigo-900 mt-3">Rp</div>
                                <div class="font-black text-indigo-900 text-right text-[12px] sm:text-[14px] tracking-tight mt-3">${Math.round(totalModalkulakanIni).toLocaleString('id-ID')}</div>
                                
                                <!-- BARIS 3: HPP -->
                                <div class="font-bold text-indigo-900 uppercase tracking-wide mt-3">HPP</div>
                                <div class="font-black text-indigo-900 mt-3">:</div>
                                <div class="w-full mt-3"></div>
                                <div class="font-bold text-indigo-900 mt-3">Rp</div>
                                <div class="font-black text-indigo-900 text-right text-[12px] sm:text-[14px] tracking-tight mt-3">${Math.round(hppkulakan).toLocaleString('id-ID')}</div>
                                
                            </div>
                        </div>
                    </div>`;
                } else {
                    htmlKulakankulakan = `
                    <div class="bg-indigo-50/40 border-b border-indigo-100/60 p-3.5">
                        <div class="flex flex-col mb-3">
                            <p class="text-[12px] font-black text-indigo-900 uppercase tracking-widest leading-none">KULAKAN ECERAN</p>
                            <p class="text-[10px] font-bold text-slate-600 uppercase tracking-wide mt-1">
                                SATUAN UNIT: ${riwayat.qtyBeli} ${namaSatuan}
                            </p>
                        </div>
                        
                        <div class="bg-white border border-indigo-100/50 rounded-xl p-3.5 shadow-[0px_2px_10px_-3px_rgba(0,0,0,0.06)] overflow-hidden">
                            <div class="grid grid-cols-[max-content_max-content_1fr_max-content_max-content] gap-x-1.5 items-center w-full text-[10px] whitespace-nowrap">
                                
                                <div class="font-bold text-indigo-900 uppercase tracking-wide">Modal Beli kulakan</div>
                                <div class="font-black text-indigo-900">:</div>
                                <div class="w-full"></div>
                                <div class="font-bold text-indigo-900">Rp</div>
                                <div class="font-black text-indigo-900 text-right text-[12px] sm:text-[14px] tracking-tight">${Math.round(totalModalkulakanIni).toLocaleString('id-ID')}</div>
                                
                                <div class="font-bold text-indigo-900 uppercase tracking-wide mt-3">HPP</div>
                                <div class="font-black text-indigo-900 mt-3">:</div>
                                <div class="w-full mt-3"></div>
                                <div class="font-bold text-indigo-900 mt-3">Rp</div>
                                <div class="font-black text-indigo-900 text-right text-[12px] sm:text-[14px] tracking-tight mt-3">${Math.round(hppkulakan).toLocaleString('id-ID')}</div>
                                
                            </div>
                        </div>
                    </div>`;
                }
            } else {
                htmlKulakankulakan = `
                <div class="bg-slate-50/80 border-b border-slate-100 p-3.5">
                    <div class="flex flex-col mb-3">
                        <p class="text-[12px] font-black text-slate-700 uppercase tracking-widest leading-none">Data Awal / Migrasi</p>
                        <p class="text-[10px] font-bold text-slate-500 mt-1">Migrasi database lama</p>
                    </div>
                    
                    <div class="bg-white border border-slate-200/70 rounded-xl p-3.5 shadow-[0px_2px_10px_-3px_rgba(0,0,0,0.06)] overflow-hidden">
                        <div class="grid grid-cols-[max-content_max-content_1fr_max-content_max-content] gap-x-1.5 items-center w-full text-[10px] whitespace-nowrap">
                            
                            <div class="font-bold text-slate-600 uppercase tracking-wide">Modal kulakan</div>
                            <div class="font-black text-slate-600">:</div>
                            <div class="w-full"></div>
                            <div class="font-bold text-slate-600">Rp</div>
                            <div class="font-black text-slate-600 text-right text-[12px] sm:text-[14px] tracking-tight">${Math.round(totalModalkulakanIni).toLocaleString('id-ID')}</div>
                            
                            <div class="font-bold text-slate-600 uppercase tracking-wide mt-3">Harga Modal (HPP)</div>
                            <div class="font-black text-slate-600 mt-3">:</div>
                            <div class="w-full mt-3"></div>
                            <div class="font-bold text-slate-600 mt-3">Rp</div>
                            <div class="font-black text-slate-800 text-right text-[12px] sm:text-[14px] tracking-tight mt-3">${Math.round(hppkulakan).toLocaleString('id-ID')}</div>
                            
                        </div>
                    </div>
                </div>`;
            }

            let iskulakanHabis = sisakulakanIni <= 0;
            
            // --- PEMBARUAN VISUAL KARTU kulakan (ELEGAN & TERPISAH TEGAS) ---
            let cardWrapperStyle = iskulakanHabis 
                ? 'bg-slate-50 border border-slate-200 border-l-[5px] border-l-slate-300 rounded-xl mb-4 shadow-sm opacity-80' 
                : 'bg-white border border-slate-200 border-l-[5px] border-l-indigo-500 rounded-xl mb-4 shadow-md';
                
            let teksStokkulakan = iskulakanHabis ? 'text-slate-400' : 'text-emerald-600';
            let headerkulakanStyle = iskulakanHabis ? 'bg-slate-100/60 text-slate-400' : 'bg-slate-100 text-slate-600';
            let iconkulakanStyle = iskulakanHabis ? 'text-slate-300' : 'text-indigo-400';
            
            htmlkulakan += `
            <div class="${cardWrapperStyle} transition-all relative overflow-hidden flex flex-col">
                
                <!-- HEADER kulakan (LEBIH MENONJOL & TEGAS) -->
                <div class="flex justify-between items-center ${headerkulakanStyle} px-3 py-2 border-b border-slate-200">
                    <span class="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <i class="fa-solid fa-layer-group ${iconkulakanStyle}"></i> kulakan ${indexkulakan + 1}
                    </span>
                    <span class="text-[9px] font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-slate-200/70 shadow-sm">${f.tanggalNota || '-'}</span>
                </div>

                <!-- BLOK KULAKAN & HPP (PENGGABUNGAN BARU) -->
                ${htmlKulakankulakan}

                <!-- BLOK UTAMA (STOK AWAL - SISA STOK - TERJUAL) -->
                <div class="p-2.5">
                    <div class="flex items-stretch justify-between bg-slate-50/70 p-2 rounded-xl border border-slate-200/60 shadow-inner mb-3">
                        <!-- KIRI: STOK AWAL -->
                        <div class="flex flex-col items-center justify-center w-1/4">
                            <p class="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Awal</p>
                            <p class="text-sm font-black text-slate-600 leading-none">${stokAwalkulakan}</p>
                        </div>
                        
                        <!-- TENGAH: SISA STOK & RINCIAN -->
                        <div class="flex flex-col items-center justify-center flex-1 border-x border-slate-200/70 px-2">
                            <p class="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Sisa Stok</p>
                            <p class="text-xl font-black ${teksStokkulakan} leading-none drop-shadow-sm mb-1.5">${sisakulakanIni}</p>
                            <div class="flex flex-col w-full gap-1">
                                <div class="flex items-center justify-between text-[8px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-sm">
                                    <span class="flex items-center gap-1"><i class="fa-solid fa-box text-slate-400"></i> Gudang</span>
                                    <span class="font-black text-slate-700">${sisaGudang}</span>
                                </div>
                                <div class="flex items-center justify-between text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shadow-sm">
                                    <span class="flex items-center gap-1"><i class="fa-solid fa-store text-emerald-400"></i> Etalase</span>
                                    <span class="font-black">${sisaEtalase}</span>
                                </div>
                            </div>
                        </div>

                        <!-- KANAN: TERJUAL -->
                        <div class="flex flex-col items-center justify-center w-1/4">
                            <p class="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Terjual</p>
                            <p class="text-sm font-black text-amber-500 leading-none drop-shadow-sm">${terjualkulakan}</p>
                        </div>
                    </div>

                    <!-- MINI DASHBOARD FINANSIAL kulakan -->
                    <div class="grid grid-cols-3 gap-1.5 bg-slate-50/50 p-1.5 rounded-lg border border-slate-100/50">
                        <div class="bg-white rounded p-1.5 border border-blue-100 shadow-sm text-center">
                            <p class="text-[7.5px] font-black text-blue-500 uppercase tracking-widest mb-0.5">Omset</p>
                            <p class="text-[9px] font-black text-blue-700">${rupiah(Math.round(omsetkulakan))}</p>
                        </div>
                        <div class="bg-white rounded p-1.5 border border-rose-100 shadow-sm text-center">
                            <p class="text-[7.5px] font-black text-rose-500 uppercase tracking-widest mb-0.5">HPP Keluar</p>
                            <p class="text-[9px] font-black text-rose-700">${rupiah(Math.round(hppKeluarkulakan))}</p>
                        </div>
                            <div class="bg-emerald-50 rounded p-1.5 border border-emerald-200 shadow-sm text-center">
                            <p class="text-[7.5px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Laba kulakan</p>
                            <p class="text-[9px] font-black text-emerald-700">${rupiah(Math.round(labakulakan))}</p>
                        </div>
                    </div>
                </div>
            </div>`;
        });


        // AKUMULASI KE NERACA KESELURUHAN (GLOBAL)
        totalStokKeseluruhan += sisaStokBatchIni;
        totalModalTertanamKeseluruhan += modalTertanamBatch;
        totalModalDikeluarkanKeseluruhan += totalModalBatch;
        
        let htmlFinansialBatch = `
        <div class="mt-3 pt-3 border-t border-slate-200 border-dashed">
            <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-1 text-center"><i class="fa-solid fa-calculator text-slate-400 mr-1"></i> Total Performa Batch</p>
            
            <!-- SUNTIKAN RINCIAN MODAL BATCH -->
            <div class="flex justify-between items-center text-[8.5px] font-bold text-slate-500 mb-2 px-1">
                <span class="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"><i class="fa-solid fa-sack-dollar text-slate-400 mr-1"></i>Modal: <span class="text-slate-700">${rupiah(Math.round(totalModalBatch))}</span></span>
                <span class="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"><i class="fa-solid fa-box-archive text-slate-400 mr-1"></i>Tertanam: <span class="text-slate-700">${rupiah(Math.round(modalTertanamBatch))}</span></span>
            </div>

            <div class="grid grid-cols-3 gap-1.5">
                <div class="bg-blue-50/70 rounded-lg p-2 border border-blue-100 text-center flex flex-col justify-center">
                    <p class="text-[7.5px] font-black text-blue-600 uppercase tracking-widest mb-0.5">T. Omset</p>
                    <p class="text-[11px] font-black text-blue-800">${rupiah(Math.round(pendapatanBatchIni))}</p>
                </div>
                <div class="bg-rose-50/70 rounded-lg p-2 border border-rose-100 text-center flex flex-col justify-center">
                    <p class="text-[7.5px] font-black text-rose-600 uppercase tracking-widest mb-0.5">T. HPP</p>
                    <p class="text-[11px] font-black text-rose-800">${rupiah(Math.round(hppKeluarBatchIni))}</p>
                </div>
                <div class="bg-emerald-50/70 rounded-lg p-2 border border-emerald-100 text-center shadow-inner flex flex-col justify-center">
                    <p class="text-[7.5px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">T. Laba</p>
                    <p class="text-[11px] font-black text-emerald-700">${rupiah(Math.round(labaBatchIni))}</p>
                </div>
            </div>
            <p class="text-[8px] font-bold text-slate-400 text-center mt-2 italic">*Kalkulasi presisi perpetual dari akumulasi ${terjualBatchIni} stok terjual pada Batch ini.</p>
        </div>`;

        let isBatchHabis = sisaStokBatchIni <= 0;
        let pitaBatch = isBatchHabis ? 'bg-slate-300' : 'bg-blue-400';
        let bgHeaderBatch = isBatchHabis ? 'bg-slate-100' : 'bg-blue-50';
        let teksHeaderBatch = isBatchHabis ? 'text-slate-500' : 'text-blue-700';
        let expTeks = b.expired ? `<span class="${isBatchHabis ? 'text-slate-400' : 'text-red-500'} font-bold">${b.expired}</span>` : `<span class="text-slate-400 font-medium">Tanpa Exp</span>`;
        
        htmlBatches += `
        <div class="bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm mb-4 relative overflow-hidden group">
            <div class="absolute left-0 top-0 bottom-0 w-1.5 ${pitaBatch}"></div>
            <div class="pl-3 pr-1 py-1">
                <div class="${bgHeaderBatch} rounded-xl px-3 py-2 flex justify-between items-center mb-3 border border-slate-100">
                    <span class="text-[11px] font-black ${teksHeaderBatch} uppercase tracking-widest">BATCH ${indexBatch + 1}</span>
                    <span class="text-[10px] font-bold text-slate-600">Exp: ${expTeks}</span>
                </div>
                <div class="pl-0.5 pr-1.5 pb-1">
                    ${htmlkulakan}
                    ${htmlFinansialBatch}
                </div>
            </div>
        </div>`;
    });

    let barcodeHTML = '';
    if(referensi.barcode || referensi.qrcode) {
        barcodeHTML = `
        <div class="flex justify-between items-center border-t border-slate-50 pt-2 mt-2">
            <span class="text-xs font-semibold text-slate-500"><i class="fa-solid fa-barcode text-slate-400 w-4 text-center mr-1"></i> Barcode / QR</span>
            <span class="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">${referensi.barcode || referensi.qrcode}</span>
        </div>`;
    }

    let html = `
    <div class="space-y-3 pb-4">
        
        <!-- INFORMASI PRODUK INDUK -->
        <div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm mt-2 relative overflow-hidden">
            <div class="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-0 opacity-50 pointer-events-none"></div>
            <div class="relative z-10">
                <div class="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informasi Etalase</p>
                    <span class="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shadow-sm">${referensi.kategori || '-'}</span>
                </div>
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-semibold text-slate-500">Varian / Kemasan</span>
                    <span class="text-xs font-bold text-slate-800">${referensi.varian || '-'}</span>
                </div>
                <div class="flex justify-between items-center border-t border-slate-50 pt-2">
                    <span class="text-xs font-semibold text-slate-500">Harga Jual (Satu Nyawa)</span>
                    <span class="text-base font-black text-emerald-600">${rupiah(referensi.jual)}</span>
                </div>
                ${barcodeHTML}
            </div>
        </div>

        <div class="mt-5 mb-2 flex items-center gap-2 pl-1 border-l-2 border-corporate-500">
            <i class="fa-solid fa-book-open-reader text-corporate-500 ml-2"></i>
            <h4 class="text-[11px] font-black text-slate-700 uppercase tracking-wider">Buku Rekening Obat (Batch & kulakan)</h4>
        </div>
        
        ${htmlBatches}

        <!-- KOTAK BIRU REKAPITULASI TOTAL ASET -->
        <div class="bg-gradient-to-br from-corporate-700 to-corporate-900 text-white p-5 rounded-2xl mt-4 relative overflow-hidden shadow-lg border border-corporate-600">
            <i class="fa-solid fa-vault absolute -right-6 -bottom-6 text-7xl text-corporate-500 opacity-20 transform -rotate-12"></i>
            <p class="text-[10px] font-black text-corporate-200 uppercase tracking-widest mb-3 relative z-10 border-b border-corporate-600 pb-2 flex justify-between items-center">
                <span>Neraca Mikro Keseluruhan</span>
                <i class="fa-solid fa-chart-pie opacity-70"></i>
            </p>
            
            <div class="flex justify-between items-center mb-3 relative z-10">
                <span class="text-xs font-medium text-corporate-100">Total Sisa Stok:</span>
                <span class="text-base font-black text-white drop-shadow-sm">${totalStokKeseluruhan} Biji</span>
            </div>
            
            <div class="flex justify-between items-center mb-3 relative z-10">
                <span class="text-[11px] font-medium text-corporate-200">Modal Dikeluarkan:</span>
                <span class="text-sm font-bold text-corporate-100">${rupiah(Math.round(totalModalDikeluarkanKeseluruhan))}</span>
            </div>
            
            <div class="flex justify-between items-end relative z-10 border-t border-corporate-600/50 pt-3">
                <span class="text-xs font-bold text-corporate-100">Aset Modal Tersisa:</span>
                <span class="text-2xl font-black text-amber-400 drop-shadow-md">${rupiah(Math.round(totalModalTertanamKeseluruhan))}</span>
            </div>
        </div>
        
    </div>
    `;
    
    document.getElementById('bodyDetailObatMobile').innerHTML = html;
    bukaModalMobile('modalDetailObatMobile', 'panelDetailObatMobile');
}

