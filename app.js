// app.js - Sistem Kendali & Mesin Logika Apotek Arsyila

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

    cashierHistory.forEach(t => {
        if (t.tanggal === tglHariIni && !t.isPelunasan) {
            omzet += t.total || 0; laba += t.laba || 0; hpp += ((t.total || 0) - (t.laba || 0));
            totalItemTerjualHariIni += (t.item || 0); // MENGHITUNG ITEM TERJUAL
            totalPembeliHariIni++; // 1 STRUK = 1 PEMBELI
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

    document.getElementById('berandaOmzet').textContent = rupiah(omzet);
    document.getElementById('berandaHPP').textContent = '- ' + rupiah(hpp);
    document.getElementById('berandaLaba').textContent = rupiah(laba);

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
            if (labelBawah) labelBawah.innerHTML = `Sisa Kembali Modal: <span class="text-red-500 font-black">Rp 0</span>`;
            if (progressBar) { progressBar.className = "h-full bg-gradient-to-r from-red-500 to-amber-400 rounded-full transition-all duration-1000"; progressBar.style.width = "0%"; }
        } else if (tercapai < targetHutang) {
            // DEFISIT (Gambar 7 & Default)
            let sisaHutang = targetHutang - tercapai; 
            let persen = targetHutang === 0 ? 0 : (tercapai / targetHutang) * 100;
            if (labelBawah) labelBawah.innerHTML = `Sisa Kembali Modal: <span class="text-red-500 font-black">${rupiah(sisaHutang)}</span>`;
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
    if (document.getElementById('panelStokSisa')) document.getElementById('panelStokSisa').textContent = totalSisaStok;
    if (document.getElementById('panelStokTerjual')) document.getElementById('panelStokTerjual').textContent = totalItemTerjualHariIni;
    if (document.getElementById('panelStokTotal')) document.getElementById('panelStokTotal').textContent = totalSisaStok + totalItemTerjualHariIni;    

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
    cashierHistory.filter(t => !t.isPelunasan).forEach(trx => {
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
        let qtyAwal = g.totalStok + qtyEtalase + qtyTerjual; 
        
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
                    <span>Beli: <span class="text-red-400">${rupiah(b.modal)}</span></span>
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
        let subTeks = (i.varian || i.keterangan) ? `<p class="text-[9px] text-slate-400 italic mt-0.5">${i.varian || ''} ${i.keterangan || ''}</p>` : '';
        return `<div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3"><div class="flex-1 pr-2 border-r border-slate-100"><h3 class="font-black text-slate-800 text-sm leading-tight">${i.nama}</h3>${subTeks}<p class="text-[10px] text-corporate-500 font-bold uppercase tracking-widest mt-1.5">${i.kategori || 'Tanpa Kategori'}</p></div><div class="flex flex-col items-end shrink-0 pl-1"><p class="font-black text-corporate-700 text-base mb-1">${rupiah(i.jual)}</p><div class="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-inner"><i class="fa-solid fa-boxes-stacked text-[9px]"></i><span class="font-black text-xs">${i.stok}</span></div></div></div>`;
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
        try { if (navigator.vibrate) navigator.vibrate(100); } catch (e) {}
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
    localStorage.setItem('apotek_cashierHistory', JSON.stringify(cashierHistory));
    batalSeleksiRiwayat();
}

function prosesArsipMasalRiwayat() {
    if(itemTerpilihRiwayat.length === 0) return;
    let isKeArsip = riwayatTabAktifMobile !== 'arsip'; 
    cashierHistory.forEach(t => { if(itemTerpilihRiwayat.includes(t.id)) t.isArsip = isKeArsip; });
    localStorage.setItem('apotek_cashierHistory', JSON.stringify(cashierHistory));
    batalSeleksiRiwayat();
    try { if (navigator.vibrate) navigator.vibrate([100, 50, 100]); } catch (e) {}
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

    wadah.innerHTML = dataTampil.map(t => {
        let badgeWarna = t.metode === 'Tunai' ? 'bg-emerald-100 text-emerald-700' : (t.metode === 'QRIS' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700');
        let teksStatus = t.metode;
        if(t.metode === 'Debt' && t.statusLunas) teksStatus = 'Lunas / Ditutup';
        if(t.isPelunasan) teksStatus = 'Uang Masuk (Kasbon)';

        let isSelected = itemTerpilihRiwayat.includes(t.id);
        let bgCard = isSelected ? 'bg-blue-50 border-blue-400 shadow-md transform scale-[0.98]' : 'bg-white border-slate-200 shadow-sm';
        let starIcon = t.isBintang ? `<i class="fa-solid fa-star text-amber-400 text-xs drop-shadow-sm ml-1.5 align-middle -mt-0.5"></i>` : '';

        let tombolAksi = modeSeleksiRiwayatAktif ? '' : `
            <div class="flex gap-2 relative z-10">
                <button onclick="event.stopPropagation(); prosesBatalTransaksiMobile(${t.id})" class="text-[10px] text-red-500 hover:bg-red-50 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-red-100 shadow-sm active:scale-95"><i class="fa-solid fa-rotate-left"></i> Batal</button>
                <button onclick="event.stopPropagation(); prosesCetakStrukMobile(${t.id}, this)" class="text-[10px] text-blue-600 hover:bg-blue-50 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-blue-100 shadow-sm active:scale-95"><i class="fa-solid fa-print"></i> Cetak</button>
            </div>`;

        return `
        <div onpointerdown="mulaiTekanRiwayat(${t.id})" onpointerup="lepasTekanRiwayat()" onpointerleave="lepasTekanRiwayat()" onclick="klikItemRiwayat(${t.id})" class="${bgCard} select-none border rounded-2xl p-4 flex flex-col gap-3 transition-all cursor-pointer relative overflow-hidden group">
            <div class="flex justify-between items-start border-b ${isSelected ? 'border-blue-200' : 'border-slate-100'} pb-3 pointer-events-none">
                <div class="pr-2 flex-1">
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1"><i class="fa-regular fa-clock"></i> ${t.waktu}</p>
                    <h3 class="font-bold text-slate-800 text-sm leading-tight inline-block">${t.obat} ${starIcon}</h3>
                    <p class="text-[10px] text-slate-500 font-medium mt-1">Oleh: ${t.kasir}</p>
                </div>
                <div class="text-right shrink-0">
                    <p class="font-black ${isSelected ? 'text-blue-700' : 'text-corporate-700'} text-base">${rupiah(t.total)}</p>
                    <span class="inline-block mt-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${badgeWarna}">${teksStatus}</span>
                </div>
            </div>
            <div class="flex items-center justify-between border-t ${isSelected ? 'border-blue-200' : 'border-slate-100'} pt-3 mt-1 pointer-events-none">
                <span class="text-xs font-semibold ${isSelected ? 'text-blue-600' : 'text-slate-500'}">${t.item} Item</span>
            </div>
            <div class="absolute bottom-4 right-4">${tombolAksi}</div>
        </div>`;
    }).join('');
}

// ==========================================
// 6. MESIN RENDER: PIUTANG & LAPORAN
// ==========================================
function renderPiutangMobile() {
    const wadah = document.getElementById('daftarPiutangMobile');
    let totalPiutang = 0;
    const dataPiutang = cashierHistory.filter(t => t.metode === 'Debt');
    
    if (dataPiutang.length === 0) {
        wadah.innerHTML = `<div class="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm mt-4"><i class="fa-solid fa-face-smile-beam text-5xl text-emerald-400 mb-3 block"></i><p class="font-bold text-slate-600">Bagus Sekali!</p><p class="text-xs text-slate-500 mt-1">Tidak ada pelanggan yang menunggak.</p></div>`;
        document.getElementById('headerTotalPiutangMobile').textContent = rupiah(0);
        return;
    }

    wadah.innerHTML = dataPiutang.map(t => {
        const nama = t.pelanggan || 'Pelanggan Tanpa Nama';
        const waLink = t.wa ? `<button onclick="tagihViaWAMobile(${t.id})" class="text-[10px] text-emerald-600 hover:text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1 shrink-0 transition-transform active:scale-95 shadow-sm"><i class="fa-brands fa-whatsapp"></i> Kirim Struk</button>` : '';

        if (t.statusLunas) {
            return `<div class="bg-slate-50 border-2 border-emerald-400 rounded-2xl p-4 shadow-sm opacity-70"><div class="flex justify-between items-start mb-2"><div><span class="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Sudah Lunas</span><h4 class="font-bold text-slate-800 text-sm mt-1 uppercase">${nama}</h4></div><p class="font-black text-emerald-600 line-through">${rupiah(t.total)}</p></div><p class="text-[10px] text-slate-500 leading-tight">${t.obat}</p></div>`;
        } else {
            totalPiutang += t.total || 0;
            return `<div class="bg-white border-2 border-red-200 rounded-2xl p-4 shadow-sm relative overflow-hidden"><div class="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-full -z-0"></div><div class="flex justify-between items-start mb-3 relative z-10"><div class="pr-2"><h4 class="font-black text-slate-800 text-base uppercase leading-tight">${nama}</h4><p class="text-[10px] text-slate-500 font-semibold mt-0.5"><i class="fa-regular fa-calendar mr-1"></i>${t.tanggal}</p></div>${waLink}</div><div class="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3 relative z-10"><p class="text-xs font-semibold text-slate-700 leading-tight mb-2">${t.obat}</p><div class="flex justify-between items-center border-t border-slate-200 pt-2"><span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tunggakan</span><span class="font-black text-red-600 text-lg">${rupiah(t.total)}</span></div></div><button onclick="bukaModalPelunasanMobile(${t.id})" class="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 relative z-10 text-sm"><i class="fa-solid fa-hand-holding-dollar"></i> Lunasi Tagihan</button></div>`;
        }
    }).join('');
    document.getElementById('headerTotalPiutangMobile').textContent = rupiah(totalPiutang);
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

    let barangEtalase = etalaseItems.find(e => e.dnaInduk === dnaIndukTransferAktif || e.nama === namaObat);
    if(!barangEtalase) { 
        barangEtalase = { dnaInduk: dnaIndukTransferAktif, nama: namaObat, kategori: kategoriObat, jual: jualObat, stok: 0, antreanFIFO: [] }; 
        etalaseItems.push(barangEtalase); 
    }

    // Proses Penyedotan per Batch
    for (let i = 0; i < batchesGudang.length; i++) {
        let batch = batchesGudang[i];
        if (sisaYgHarusDipindah <= 0) break;

        let jumlahDiambil = Math.min(batch.stok, sisaYgHarusDipindah);
        batch.stok -= jumlahDiambil;
        sisaYgHarusDipindah -= jumlahDiambil;
        barangEtalase.stok += jumlahDiambil;

        if(!barangEtalase.antreanFIFO) barangEtalase.antreanFIFO = [];
        let batchSamaDiEtalase = barangEtalase.antreanFIFO.find(b => b.idBatch === batch.idBatch);
        
        if(batchSamaDiEtalase) { 
            batchSamaDiEtalase.stok += jumlahDiambil; 
        } else { 
            barangEtalase.antreanFIFO.push({ idBatch: batch.idBatch, modal: batch.modal, stok: jumlahDiambil, expired: batch.expired }); 
        }
    }

    barangEtalase.antreanFIFO.sort((a, b) => new Date(a.expired || '2099-12-31') - new Date(b.expired || '2099-12-31'));

    localStorage.setItem('apotek_masterItems', JSON.stringify(masterItems)); 
    localStorage.setItem('apotek_etalaseItems', JSON.stringify(etalaseItems));
    tutupModalMobile('modalTransferMobile'); 
    renderGudangMobile(document.getElementById('cariGudangMobile').value); 
    renderBerandaMobile(); 
    try { if (navigator.vibrate) navigator.vibrate([100, 50, 100]); } catch (e) {}
    alert("├░┼╕┼б┼б " + inputQty + " " + namaObat + " berhasil dipindah ke Etalase!");
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
        if (qtySuntikan > 0 && (siklusAktif.isLikuidasi || siklusAktif.isLanjutanDefisit)) {
            siklusAktif.isLikuidasi = false; 
            siklusAktif.isLanjutanDefisit = false;
            siklusAktif.hutangAwal = 0;
            siklusAktif.modalAwal = 0; siklusAktif.qtyAwal = 0; siklusAktif.uangMasuk = 0;
            siklusAktif.modalTambahan = 0; siklusAktif.qtyTambahan = 0;
        }

    if (isKulakanBaru || isAddingNewBatchMobile) {
        const idBatchBaru = 'B-' + Date.now() + '-' + Math.floor(Math.random()*1000);
        masterItems.unshift({ 
            idBatch: idBatchBaru, dnaInduk: referensi.dnaInduk, barcode: referensi.barcode, qrcode: referensi.qrcode,
            nama: nBaru, varian: vBaru, keterangan: '', kategori: kBaru, modal: mBaru, jual: jBaru, stok: isAddingNewBatchMobile ? sBaru : selisihStok, expired: expBaru 
        });
        
        let qtySuntikan = isAddingNewBatchMobile ? sBaru : selisihStok;
        siklusAktif.qtyTambahan += qtySuntikan; 
        siklusAktif.modalTambahan += (qtySuntikan * mBaru);
        if(!isAddingNewBatchMobile) alert("├░┼╕┬ктАЮ Sukses! Sistem otomatis merakitkan Batch Kulakan Baru di Gudang.");
    } else {
        siklusAktif.qtyTambahan += selisihStok; 
        siklusAktif.modalTambahan += (selisihStok * mBaru);
        barang.modal = mBaru; barang.jual = jBaru; barang.stok = sBaru; barang.expired = expBaru;
        alert("├в┼УтАж Data berhasil diperbarui!");
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

    localStorage.setItem('apotek_masterItems', JSON.stringify(masterItems)); localStorage.setItem('apotek_etalaseItems', JSON.stringify(etalaseItems)); localStorage.setItem('apotek_siklusAktif', JSON.stringify(siklusAktif));
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
            tampilkanConfirmMobile("├░┼╕┬ктАЮ DETEKSI KULAKAN BARU:\n\nSistem melihat Anda menambah stok (+ " + selisihStok + " Box) sekaligus merubah Tgl Kedaluwarsa/Harga Modal.\n\nApakah ini barang Kulakan Baru? (Klik 'Ya, Lanjut' agar otomatis dibuatkan Batch/Kardus baru).", 
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
            localStorage.setItem('apotek_siklusAktif', JSON.stringify(siklusAktif));
        }

        masterItems = masterItems.filter(i => i.idBatch !== idBatch);
        localStorage.setItem('apotek_masterItems', JSON.stringify(masterItems));
        
        let sisaBatches = masterItems.filter(i => i.dnaInduk === dnaIndukHapusAktif);
        if (sisaBatches.length === 0) {
            tutupModalMobile('modalHapusCerdasMobile');
        } else {
            renderListHapusBatchMobile(); 
        }
        
        renderGudangMobile(document.getElementById('cariGudangMobile').value); 
        renderBerandaMobile();
        alert(`├в┼УтАж Batch ${urutanBatch} berhasil dihapus dari sistem.`);
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
        localStorage.setItem('apotek_masterItems', JSON.stringify(masterItems));
        renderGudangMobile(document.getElementById('cariGudangMobile').value); renderBerandaMobile();
        alert(`├в┼УтАж Obat ${namaObat} berhasil dihapus dari Gudang.`);
    });
}
// ==========================================
// 11. MESIN TAMBAH OBAT BARU (SMART CALCULATOR)
// ==========================================

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
    // Reset Form Input
    document.getElementById('tambahBarcodeMobile').value = ''; document.getElementById('tambahQrcodeMobile').value = ''; 
    document.getElementById('tambahNamaMobile').value = ''; document.getElementById('tambahVarianMobile').value = '';
    document.getElementById('tambahKategoriMobile').value = 'Sakit Kepala'; document.getElementById('tambahKategoriKustom').value = '';
    document.getElementById('tambahSatuanEceran').value = 'Pak'; document.getElementById('tambahSatuanBesar').value = 'Dos';
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
    
    // Ambil Data Input
    let satEcer = document.getElementById('tambahSatuanEceran').value || 'Pak';
    let satBesar = document.getElementById('tambahSatuanBesar').value || 'Dos';
    let qtyBeli = parseFloat(document.getElementById('tambahQtyBeli').value) || 0;
    let isiPerSatuan = parseFloat(document.getElementById('tambahIsiPerSatuan').value) || 1;
    let modalKotor = parseFloat(document.getElementById('tambahModalKotor').value) || 0;
    let jualEceran = parseFloat(document.getElementById('tambahJualEceran').value) || 0;

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
    document.getElementById('tambahModalKotor').dataset.calculatedHpp = Math.round(hppEceran);
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
    
    const jual = parseFloat(document.getElementById('tambahJualEceran').value) || 0; 
    const expired = document.getElementById('tambahExpiredMobile').value;
    
    // Tarik data hasil kalkulator
    const modal = parseFloat(document.getElementById('tambahModalKotor').dataset.calculatedHpp) || 0;
    const stok = parseFloat(document.getElementById('tambahQtyBeli').dataset.calculatedStok) || 0;
    
    // satEcer hanya dipakai untuk notifikasi "Sukses" di bawah, tidak disimpan ke database identitas
    const satEcer = document.getElementById('tambahSatuanEceran').value || 'Pcs'; 

    if(!nama || !kategori || isNaN(modal) || isNaN(jual) || stok === 0) return alert('⚠️ Wajib diisi: Nama, Jumlah, Modal, dan Jual!');
    if(modal >= jual) return alert('⚠️ Peringatan: Harga Jual Eceran harus lebih tinggi dari HPP Eceran.');
    
    const idBatch = 'B-' + Date.now(); 
    let dnaInduk = '';
    if (qrcode) { dnaInduk = qrcode; } else if (barcode) { dnaInduk = barcode; } 
    else {
        let cekGudang = masterItems.find(m => m.nama.toLowerCase() === nama.toLowerCase());
        if (cekGudang && cekGudang.dnaInduk) { dnaInduk = cekGudang.dnaInduk; } else { dnaInduk = 'DNA-' + Date.now(); }
    }

    // SIMPAN KE MEMORI: `varian` murni mengambil teks varian yang diketik, bukan "Pak/Strip"
    masterItems.unshift({ idBatch, dnaInduk, barcode, qrcode, nama, varian: varian, keterangan: '', kategori, modal, jual, stok, expired });
    
    if (stok > 0 && (siklusAktif.isLikuidasi || siklusAktif.isLanjutanDefisit)) {
        siklusAktif.isLikuidasi = false;
        siklusAktif.isLanjutanDefisit = false;
        siklusAktif.hutangAwal = 0;
        siklusAktif.modalAwal = 0; siklusAktif.qtyAwal = 0; siklusAktif.uangMasuk = 0;
        siklusAktif.modalTambahan = 0; siklusAktif.qtyTambahan = 0;
    }

    let nilaiSuntikan = modal * stok; 
    if (siklusAktif.qtyAwal === 0 && siklusAktif.qtyTambahan === 0) { siklusAktif.modalAwal += nilaiSuntikan; siklusAktif.qtyAwal += stok; } 
    else { siklusAktif.modalTambahan += nilaiSuntikan; siklusAktif.qtyTambahan += stok; }

    localStorage.setItem('apotek_masterItems', JSON.stringify(masterItems)); localStorage.setItem('apotek_siklusAktif', JSON.stringify(siklusAktif));
    tutupModalMobile('modalTambahObatMobile'); renderGudangMobile(document.getElementById('cariGudangMobile').value); renderBerandaMobile();
    alert('✅ Sukses! ' + stok + ' ' + satEcer + ' ' + nama + ' berhasil ditambahkan ke Gudang.');
}

// ==========================================
// 12. MESIN KASIR & KERANJANG (POINT OF SALE)
// ==========================================
let keranjangKasirMobile = [];

function bukaModalKasirMobile() {
    keranjangKasirMobile = []; renderKeranjangMobile();
    const select = document.getElementById('kasirPilihObatMobile');
    select.innerHTML = '<option value="">+ Pilih obat dari etalase...</option>';
    let adaBarang = false;
    etalaseItems.forEach(item => { if(item.stok > 0) { select.innerHTML += `<option value="${item.nama}">${item.nama} (Stok: ${item.stok})</option>`; adaBarang = true; } });
    if(!adaBarang) return alert("Etalase masih kosong! Masuk ke menu Gudang lalu transfer stok ke Etalase.");
    
    document.querySelector('input[value="Tunai"]').checked = true; toggleFormKasbonMobile();
    bukaModalMobile('modalKasirMobile', 'panelKasirMobile');
}

function tambahManualKeKeranjangMobile() {
    const nama = document.getElementById('kasirPilihObatMobile').value;
    if(nama) {
        let barang = etalaseItems.find(e => e.nama === nama);
        if(barang) masukkanKeKeranjangMobile(barang);
        document.getElementById('kasirPilihObatMobile').value = ''; 
    }
}

function masukkanKeKeranjangMobile(barang) {
    let index = keranjangKasirMobile.findIndex(k => k.nama === barang.nama);
    if(index !== -1) {
        if(keranjangKasirMobile[index].qty < barang.stok) { keranjangKasirMobile[index].qty++; } else { alert("Sisa stok " + barang.nama + " tidak cukup!"); }
    } else {
        keranjangKasirMobile.push({ nama: barang.nama, varian: barang.varian, keterangan: barang.keterangan, jual: barang.jual, qty: 1, stokMax: barang.stok });
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
                    if(batch.stok > 0) { let ambil = Math.min(sisaQtyDipotong, batch.stok); batch.stok -= ambil; sisaQtyDipotong -= ambil; totalModalItemIni += (ambil * batch.modal); if(sisaQtyDipotong <= 0) break; }
                }
                bEtalase.antreanFIFO = bEtalase.antreanFIFO.filter(b => b.stok > 0);
            } else { let bMaster = masterItems.find(m => m.nama === k.nama); totalModalItemIni = (bMaster ? bMaster.modal : 0) * k.qty; }
        }
        totalLaba += ((k.jual * k.qty) - totalModalItemIni);
        k.hppSatuan = Math.round(totalModalItemIni / k.qty); // SIMPAN HPP UNTUK RETUR
    });

    if (metode !== 'Debt') siklusAktif.uangMasuk += totalBelanja; 
    const namaObatFinal = namaObatGabungan.length > 1 ? `${namaObatGabungan[0]} + ${namaObatGabungan.length - 1} lainnya` : namaObatGabungan[0];
    const tglWaktu = new Date();

    cashierHistory.unshift({ 
        id: Date.now(), tanggal: getTanggalLokal(), waktu: tglWaktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), 
        obat: namaObatFinal, detailKeranjang: JSON.parse(JSON.stringify(keranjangKasirMobile)), 
        kasir: 'Pemilik', item: totalItem, total: totalBelanja, metode: metode, laba: totalLaba, pelanggan: namaPelanggan, wa: waPelanggan, isPelunasan: false 
    });

    // TEMBAKKAN ALARM NOTIFIKASI
    if (metode === 'Debt') {
        kirimNotifikasiMobile('Kasbon / Piutang', `${namaObatFinal} berstatus kasbon atas nama ${namaPelanggan}.`, 'piutang', totalBelanja);
    } else {
        kirimNotifikasiMobile('Pembelian Baru', `${namaObatFinal} laku terjual secara ${metode}.`, 'beli', totalBelanja);
    }

    localStorage.setItem('apotek_etalaseItems', JSON.stringify(etalaseItems)); localStorage.setItem('apotek_cashierHistory', JSON.stringify(cashierHistory)); localStorage.setItem('apotek_siklusAktif', JSON.stringify(siklusAktif));
    tutupModalMobile('modalKasirMobile'); renderBerandaMobile(); 
    if(!document.getElementById('layar-gudang').classList.contains('hidden')) renderGudangMobile(document.getElementById('cariGudangMobile').value);
    if(!document.getElementById('layar-etalase').classList.contains('hidden')) renderEtalaseMobile();
    try { if (navigator.vibrate) navigator.vibrate([100, 50, 100]); } catch (e) {}
    alert(`├в┼УтАж Transaksi ${metode} Berhasil! Omzet telah masuk ke Beranda.`);
}

function prosesBatalTransaksiMobile(idTransaksi) {
    tampilkanConfirmMobile("Batalkan transaksi ini?\n\nUang akan ditarik dari omzet dan seluruh item akan dikembalikan ke Etalase secara akurat.", function() {
        const trx = cashierHistory.find(t => t.id === idTransaksi);
        if (trx) {
            if (!trx.isPelunasan && trx.metode !== 'Debt') { siklusAktif.uangMasuk -= (trx.total || 0); if (siklusAktif.uangMasuk < 0) siklusAktif.uangMasuk = 0; }
            
            if (trx.detailKeranjang && trx.detailKeranjang.length > 0) {
                trx.detailKeranjang.forEach(itemRetur => {
                    let bEtalase = etalaseItems.find(i => i.nama === itemRetur.nama);
                    let idBatchRetur = 'RETUR-' + Date.now() + '-' + Math.floor(Math.random() * 1000); 
                    if (bEtalase) { 
                        bEtalase.stok += itemRetur.qty; if(!bEtalase.antreanFIFO) bEtalase.antreanFIFO = [];
                        bEtalase.antreanFIFO.unshift({ idBatch: idBatchRetur, modal: itemRetur.hppSatuan || (itemRetur.jual * 0.8), stok: itemRetur.qty, expired: '' });
                    } else {
                        etalaseItems.push({ dnaInduk: 'DNA-RETUR-' + Date.now(), nama: itemRetur.nama, kategori: '├в┼б┬а├п┬╕┬П Barang Retur', jual: itemRetur.jual, stok: itemRetur.qty, antreanFIFO: [{ idBatch: idBatchRetur, modal: itemRetur.hppSatuan || (itemRetur.jual * 0.8), stok: itemRetur.qty, expired: '' }] }); 
                    }
                });
            } else { 
                let qty = trx.item || 1; let hppRetur = Math.round(((trx.total || 0) - (trx.laba || 0)) / qty);
                etalaseItems.push({ dnaInduk: 'DNA-RETUR-OLD', nama: trx.obat, kategori: '├в┼б┬а├п┬╕┬П Barang Retur', jual: Math.round((trx.total || 0) / qty), stok: qty, antreanFIFO: [{ idBatch: 'RETUR-OLD', modal: hppRetur, stok: qty, expired: '' }] });
            }
            
            cashierHistory = cashierHistory.filter(t => t.id !== idTransaksi);

            // TEMBAKKAN ALARM NOTIFIKASI BATAL
            kirimNotifikasiMobile('Transaksi Batal', `Pembelian ${trx.obat} telah dibatalkan.`, 'batal', trx.total);

            localStorage.setItem('apotek_etalaseItems', JSON.stringify(etalaseItems)); localStorage.setItem('apotek_cashierHistory', JSON.stringify(cashierHistory)); localStorage.setItem('apotek_siklusAktif', JSON.stringify(siklusAktif));
            renderRiwayatMobile(); renderBerandaMobile(); alert("├в┼УтАж Transaksi Dibatalkan. Stok setiap item diretur ke Etalase.");
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
    if(!inputID) return alert("├в┼б┬а├п┬╕┬П Ketik nomor ID transaksi yang valid!");
    
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
    if (!trx || !trx.wa) return alert("├в┼б┬а├п┬╕┬П Nomor WhatsApp pelanggan tidak ditemukan!");

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
            alert("├в┼УтАж Gambar struk akan diunduh. Silakan kirim (Drag & Drop) gambar tersebut ke WhatsApp yang akan terbuka.");
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
    let barangTersedia = masterItems.filter(o => o.stok > 0 && o.nama !== '___SYSTEM_AUTH___' && o.kategori !== '├в┼б┬а├п┬╕┬П Barang Retur');
    
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
                    barangEtalase = { dnaInduk: dnaInduk, nama: namaObat, kategori: batchesGudang[0].kategori, jual: batchesGudang[0].jual, stok: 0, antreanFIFO: [] };
                    etalaseItems.push(barangEtalase); 
                }

                for (let i = 0; i < batchesGudang.length; i++) {
                    let batch = batchesGudang[i];
                    if (sisaYgHarusDipindah <= 0) break;

                    let jumlahDiambil = Math.min(batch.stok, sisaYgHarusDipindah);
                    batch.stok -= jumlahDiambil;
                    sisaYgHarusDipindah -= jumlahDiambil;
                    barangEtalase.stok += jumlahDiambil;

                    if(!barangEtalase.antreanFIFO) barangEtalase.antreanFIFO = [];
                    let batchSamaDiEtalase = barangEtalase.antreanFIFO.find(b => b.idBatch === batch.idBatch);
                    
                    if(batchSamaDiEtalase) { 
                        batchSamaDiEtalase.stok += jumlahDiambil; 
                    } else { 
                        barangEtalase.antreanFIFO.push({ idBatch: batch.idBatch, modal: batch.modal, stok: jumlahDiambil, expired: batch.expired }); 
                    }
                }
                barangEtalase.antreanFIFO.sort((a, b) => new Date(a.expired || '2099-12-31') - new Date(b.expired || '2099-12-31'));
            }
        }
    });

    if(adaYangDitransfer) {
        localStorage.setItem('apotek_masterItems', JSON.stringify(masterItems)); 
        localStorage.setItem('apotek_etalaseItems', JSON.stringify(etalaseItems));
        tutupModalMobile('modalTransferMasalMobile');
        renderGudangMobile(document.getElementById('cariGudangMobile').value); 
        renderBerandaMobile();
        try { if (navigator.vibrate) navigator.vibrate([100, 50, 100]); } catch (e) {}
        alert("├░┼╕┼б┼б Barang berhasil diberangkatkan ke Etalase secara Cerdas!");
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
    if(!nama || !alamat) return alert("├в┼б┬а├п┬╕┬П Nama Apotek dan Alamat wajib diisi!");
    
    profilApotek.nama = nama; profilApotek.alamat = alamat; profilApotek.telepon = telp;
    localStorage.setItem('apotek_profilData', JSON.stringify(profilApotek));
    document.getElementById('namaApotekHeader').innerText = nama; 
    tutupModalMobile('modalSetelanMobile'); alert("├в┼УтАж Profil Apotek berhasil diperbarui!");
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
        tutupKameraScannerMobile(); try { if (navigator.vibrate) navigator.vibrate(200); } catch (e) {} 
        
        if (targetScannerAktif === 'tambah_qr' || targetScannerAktif === 'tambah_barcode') {
            let barangSudahAda = masterItems.find(m => m.barcode === decodedText || m.qrcode === decodedText);
            if (barangSudahAda) {
                document.getElementById('tambahBarcodeMobile').value = ''; document.getElementById('tambahQrcodeMobile').value = '';
                munculkanAlertPencegatanMobile(barangSudahAda.nama, barangSudahAda.dnaInduk);
            } else {
                if(targetScannerAktif === 'tambah_qr') document.getElementById('tambahQrcodeMobile').value = decodedText;
                else document.getElementById('tambahBarcodeMobile').value = decodedText;
                alert("Kode berhasil direkam secara virtual! Silakan lengkapi sisa datanya.");
            }
        } else if (targetScannerAktif === 'lacak') {
            let match = decodedText.match(/Trx:\s*(\d+)/);
            if(match && match[1]) { document.getElementById('inputLacakIDMobile').value = match[1]; prosesLacakIDMobile(); } else { alert("├в┼б┬а├п┬╕┬П QR Code bukan struk valid."); }
        } else {
            let barangMaster = masterItems.find(m => m.barcode === decodedText || m.qrcode === decodedText);
            if(barangMaster) {
                let bEtalase = etalaseItems.find(e => e.nama === barangMaster.nama);
                if(bEtalase && bEtalase.stok > 0) { masukkanKeKeranjangMobile(bEtalase); } else { alert("STOK KOSONG di Etalase!"); }
            } else { alert("Barcode tidak terdaftar!"); }
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

function toggleSenterMobile() {
    // Torch handling logic for html5-qrcode (Requires specific device support)
    alert("Tombol senter ditekan. Jika tidak menyala, HP Anda mungkin belum mendukung kontrol lampu kilat lewat browser.");
}

// ==========================================
// 17. MESIN UI/UX (CUSTOM ALERT & CONFIRM)
// ==========================================
window.alert = function(pesan) {
    const modal = document.getElementById('modalAlertMobile'); const panel = document.getElementById('panelAlertMobile');
    const icon = document.getElementById('iconAlertMobile'); const judul = document.getElementById('judulAlertMobile');
    const btn = document.getElementById('btnAlertMobile'); const teks = document.getElementById('teksAlertMobile');
    let strPesan = String(pesan).toLowerCase();
    
    if (strPesan.includes('berhasil') || strPesan.includes('sukses') || strPesan.includes('├в┼УтАж')) {
        icon.className = 'w-16 h-16 mx-auto rounded-full bg-emerald-100 border-2 border-emerald-200 text-emerald-500 flex items-center justify-center text-3xl mb-3 shadow-inner'; icon.innerHTML = '<i class="fa-solid fa-check-circle"></i>';
        judul.className = 'font-black text-emerald-700 text-xl tracking-tight mb-2'; judul.innerText = 'Sukses!'; btn.className = 'w-full bg-emerald-500 text-white font-bold py-3.5 rounded-2xl shadow-md transition-transform active:scale-95';
    } else if (strPesan.includes('gagal') || strPesan.includes('wajib') || strPesan.includes('peringatan') || strPesan.includes('├в┼б┬а├п┬╕┬П')) {
        icon.className = 'w-16 h-16 mx-auto rounded-full bg-red-100 border-2 border-red-200 text-red-500 flex items-center justify-center text-3xl mb-3 shadow-inner animate-pulse'; icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        judul.className = 'font-black text-red-700 text-xl tracking-tight mb-2'; judul.innerText = 'Perhatian!'; btn.className = 'w-full bg-red-500 text-white font-bold py-3.5 rounded-2xl shadow-md transition-transform active:scale-95';
    } else {
        icon.className = 'w-16 h-16 mx-auto rounded-full bg-blue-100 border-2 border-blue-200 text-blue-500 flex items-center justify-center text-3xl mb-3 shadow-inner'; icon.innerHTML = '<i class="fa-solid fa-bell"></i>';
        judul.className = 'font-black text-blue-700 text-xl tracking-tight mb-2'; judul.innerText = 'Informasi'; btn.className = 'w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl shadow-md transition-transform active:scale-95';
    }
    
    teks.innerText = pesan; modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); panel.classList.remove('scale-90'); }, 10);
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
let idKasbonAktifMobile = null;

function bukaModalPelunasanMobile(idTransaksi) {
    const transaksi = cashierHistory.find(t => t.id === idTransaksi);
    if(transaksi) {
        idKasbonAktifMobile = idTransaksi;
        document.getElementById('pelunasanNamaMobile').textContent = (transaksi.pelanggan || 'Pelanggan').toUpperCase();
        document.getElementById('pelunasanTotalMobile').textContent = rupiah(transaksi.total);
        bukaModalMobile('modalPelunasanMobile', 'panelPelunasanMobile');
    }
}

function eksekusiPelunasanMobile(metodePilihan) {
    if(idKasbonAktifMobile !== null) {
        const utangLama = cashierHistory.find(t => t.id === idKasbonAktifMobile);
        if(utangLama) {
            const idBaru = Date.now();
            const tglWaktu = new Date();
            const pelunasanBaru = {
                id: idBaru, tanggal: getTanggalLokal(), waktu: tglWaktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                obat: `Pelunasan Utang: ${utangLama.pelanggan || 'Pelanggan'}`, kasir: 'Pemilik', item: 0, total: utangLama.total, metode: metodePilihan, laba: 0, pelanggan: utangLama.pelanggan, wa: utangLama.wa, isPelunasan: true, idTerkait: utangLama.id 
            };
            utangLama.statusLunas = true; utangLama.idTerkait = idBaru;
            siklusAktif.uangMasuk += utangLama.total;
            cashierHistory.unshift(pelunasanBaru);

            // TEMBAKKAN ALARM NOTIFIKASI PELUNASAN
            kirimNotifikasiMobile('Pelunasan Diterima', `Pelunasan kasbon dari ${utangLama.pelanggan} via ${metodePilihan}.`, 'lunas', utangLama.total);

            localStorage.setItem('apotek_cashierHistory', JSON.stringify(cashierHistory)); localStorage.setItem('apotek_siklusAktif', JSON.stringify(siklusAktif));
            tutupModalMobile('modalPelunasanMobile'); renderPiutangMobile(); renderBerandaMobile();
            try { if (navigator.vibrate) navigator.vibrate([100, 50, 100]); } catch (e) {}
            alert(`├в┼УтАж Pelunasan Sukses! Utang ditutup dan omzet bertambah.`);
        }
    }
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

        if (sudahUntung) {
            siklusAktif = { 
                modalAwal: totalAsetFisikSekarang, qtyAwal: totalQtyFisikSekarang, 
                modalTambahan: 0, qtyTambahan: 0, uangMasuk: 0, 
                tanggalStart: getTanggalLokal(),
                isLikuidasi: true, isLanjutanDefisit: false, hutangAwal: 0 
            };
        } else {
            // Mode Hybrid: Teks atas ikuti aset fisik, Teks bawah ikuti hutang cash
            siklusAktif = { 
                modalAwal: totalAsetFisikSekarang, qtyAwal: totalQtyFisikSekarang, 
                modalTambahan: 0, qtyTambahan: 0, uangMasuk: 0, 
                tanggalStart: getTanggalLokal(),
                isLikuidasi: false, isLanjutanDefisit: true, hutangAwal: sisaHutang 
            };
        }
        
        localStorage.setItem('apotek_siklusAktif', JSON.stringify(siklusAktif));
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
    if(!trx) return alert("├в┼б┬а├п┬╕┬П Data transaksi tidak ditemukan!");

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
        elemenTombol.innerHTML = teksAsli; alert("├в┼УтАж Cetak Berhasil! Struk dikeluarkan oleh printer.");
    } catch(error) {
        console.log("Error Printer:", error); printerApotekTerhubung = null; elemenTombol.innerHTML = '<i class="fa-solid fa-print"></i> Cetak';
        alert("├в┼б┬а├п┬╕┬П Gagal Mencetak! Pastikan Bluetooth HP menyala, lokasi diizinkan, dan Printer Thermal hidup.");
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
setInterval(() => { sinkronKeAwanMobile(); }, 10000);

document.getElementById('cariGudangMobile').addEventListener('input', (e) => { renderGudangMobile(e.target.value); });

// ==========================================
// 21. MESIN RESET TOTAL
// ==========================================
function resetSistemMobile() {
    tampilkanConfirmMobile("PERINGATAN BAHAYA!\n\nApakah Anda yakin ingin menghapus SEMUA DATA secara permanen? Gudang, Etalase, Riwayat, Laporan, dan Siklus Modal akan dikosongkan ke posisi 0.", function() {
        localStorage.setItem('apotek_masterItems', JSON.stringify([])); 
        localStorage.setItem('apotek_etalaseItems', JSON.stringify([])); 
        localStorage.setItem('apotek_cashierHistory', JSON.stringify([]));
        localStorage.setItem('apotek_siklusAktif', JSON.stringify({ modalAwal: 0, qtyAwal: 0, modalTambahan: 0, qtyTambahan: 0, uangMasuk: 0, tanggalStart: getTanggalLokal() }));
        
        alert("├в┼УтАж Sistem berhasil dibersihkan sampai ke akarnya! Memuat ulang..."); 
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
    overlay.classList.add('opacity-0'); panel.classList.add('translate-x-full'); setTimeout(() => { overlay.classList.add('hidden'); }, 300);
}

function kirimNotifikasiMobile(judul, pesan, tipe, nilaiUang) {
    const waktu = new Date(); const strWaktu = waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    notifikasiHistori.unshift({ id: Date.now(), judul, pesan, tipe, uang: nilaiUang, waktu: strWaktu, tanggal: getTanggalLokal() });
    if(notifikasiHistori.length > 30) notifikasiHistori.pop(); // Batas maksimal 30 chat
    localStorage.setItem('apotek_notifikasi', JSON.stringify(notifikasiHistori));
    
    // Nyalakan titik merah
    if(document.getElementById('badgeNotifPing')) document.getElementById('badgeNotifPing').classList.remove('hidden');
    if(document.getElementById('badgeNotifSolid')) document.getElementById('badgeNotifSolid').classList.remove('hidden');
    try { if (navigator.vibrate) navigator.vibrate([50, 100, 50]); } catch (e) {}
}

function renderListNotifikasiMobile() {
    const wadah = document.getElementById('wadahListNotifikasiMobile');
    if(notifikasiHistori.length === 0) {
        wadah.innerHTML = `<div class="text-center mt-10 opacity-40"><i class="fa-regular fa-bell-slash text-5xl mb-3 block"></i><p class="text-xs font-black uppercase tracking-widest">Belum Ada Notifikasi</p></div>`;
        return;
    }

    wadah.innerHTML = notifikasiHistori.map(n => {
        let warnaTema = '', icon = '';
        if(n.tipe === 'beli') { warnaTema = 'emerald'; icon = 'fa-solid fa-cash-register'; }
        else if(n.tipe === 'piutang') { warnaTema = 'red'; icon = 'fa-solid fa-book-open'; }
        else if(n.tipe === 'lunas') { warnaTema = 'blue'; icon = 'fa-solid fa-handshake'; }
        else if(n.tipe === 'batal') { warnaTema = 'amber'; icon = 'fa-solid fa-rotate-left'; }

        return `
        <div class="flex flex-col gap-1 w-full">
            <span class="text-[9px] font-bold text-slate-400 text-center mb-1 drop-shadow-sm">${n.tanggal === getTanggalLokal() ? 'Hari Ini' : n.tanggal}, ${n.waktu}</span>
            <div class="flex items-start gap-2">
                <div class="w-8 h-8 rounded-full bg-${warnaTema}-100 text-${warnaTema}-600 flex items-center justify-center shrink-0 border border-${warnaTema}-200 shadow-sm mt-1 z-10"><i class="${icon} text-[11px]"></i></div>
                <div class="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3 shadow-sm flex-1 relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-10 h-10 bg-${warnaTema}-50 rounded-bl-full -z-0 opacity-50"></div>
                    <div class="relative z-10">
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
    cashierHistory.filter(t => t.tanggal >= siklusAktif.tanggalStart && !t.isPelunasan).forEach(trx => {
        let qty = 0;
        if(trx.detailKeranjang) { trx.detailKeranjang.forEach(i => qty += i.qty); } else { qty = trx.item || 1; }
        if(trx.metode === 'Tunai') terjualTunai += qty;
        else if(trx.metode === 'QRIS') terjualQRIS += qty;
        else if(trx.metode === 'Debt') terjualKasbon += qty;
    });

    let sisaTotal = totalGudang + totalEtalase;
    let terjualTotal = terjualTunai + terjualQRIS + terjualKasbon;
    let absolutTotal = sisaTotal + terjualTotal;

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

        cashierHistory.filter(t => t.tanggal >= siklusAktif.tanggalStart && !t.isPelunasan).forEach(trx => {
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
// MESIN CETAK LAPORAN (OPSI 1: WINDOW.PRINT)
// ==========================================
function generatePDFLaporanMobile() {
    let tglFilter = document.getElementById('filterTglLaporanMobile')?.value || getTanggalLokal();
    let dataPeriode = cashierHistory.filter(t => t.tanggal === tglFilter);
    
    if(dataPeriode.length === 0) return alert("Data kosong! Belum ada transaksi pada tanggal ini untuk dicetak.");

    // Variabel Rekapitulasi
    let lOmzet = 0, lLaba = 0, lHPP = 0;
    let inTunai = 0, inQRIS = 0, inLunas = 0, outKasbon = 0;
    
    let htmlTabel = "";
    let urut = 1;
    
    // Perulangan Data Transaksi
    dataPeriode.forEach(t => {
        let hpp = 0, omzet = 0, laba = 0;
        let qty = t.item, namaObat = t.obat;

        if(!t.isPelunasan) {
            omzet = t.total; laba = t.laba; hpp = (t.total - t.laba);
            lOmzet += omzet; lLaba += laba; lHPP += hpp;
            
            if(t.metode === "Tunai") inTunai += omzet;
            if(t.metode === "QRIS") inQRIS += omzet;
            if(t.metode === "Kasbon") outKasbon += omzet;
        } else {
            // Jika Pelunasan Utang (Kasbon)
            qty = "-";
            namaObat = "PELUNASAN KASBON (" + (t.pelanggan || 'Pelanggan') + ")";
            omzet = t.total;
            inLunas += omzet;
            if(t.metode === "Tunai") inTunai += omzet;
            if(t.metode === "QRIS") inQRIS += omzet;
        }

        // Susun Baris Tabel HTML
        htmlTabel += `
            <tr>
                <td class="text-center">${urut++}</td>
                <td class="text-center">${t.waktu}</td>
                <td>${namaObat}</td>
                <td class="text-center t-num">${qty}</td>
                <td class="text-center">${t.metode}</td>
                <td class="text-right t-num">${hpp > 0 ? rupiah(hpp) : '-'}</td>
                <td class="text-right t-num">${rupiah(omzet)}</td>
                <td class="text-right t-num">${laba > 0 ? rupiah(laba) : '-'}</td>
            </tr>
        `;
    });

    // Mengisi Angka ke Elemen HTML Desain Anda
    document.getElementById('p-tgl').innerText = tglFilter;
    document.getElementById('p-trx').innerText = (urut - 1) + " Nota";
    document.getElementById('p-tabel-body').innerHTML = htmlTabel;
    
    document.getElementById('p-tot-hpp').innerText = rupiah(lHPP);
    document.getElementById('p-tot-omzet').innerText = rupiah(lOmzet + inLunas);
    document.getElementById('p-tot-laba').innerText = rupiah(lLaba);

    // Format fungsi rupiah tanpa 'Rp' (untuk grid bawah agar rata kanan presisi)
    const formatAngka = (num) => new Intl.NumberFormat('id-ID').format(num);

    document.getElementById('p-in-tunai').innerText = formatAngka(inTunai);
    document.getElementById('p-in-qris').innerText = formatAngka(inQRIS);
    document.getElementById('p-in-lunas').innerText = formatAngka(inLunas);
    document.getElementById('p-in-total').innerText = formatAngka(inTunai + inQRIS);
    document.getElementById('p-out-kasbon').innerText = formatAngka(outKasbon);
    
    // Uang Laci Fisik (Hanya yang Tunai)
    document.getElementById('p-laci-tunai').innerText = formatAngka(inTunai);
    document.getElementById('p-laci-total').innerText = formatAngka(inTunai);

    // Memicu Jendela Print Bawaan Browser
    setTimeout(() => {
        window.print();
    }, 500); // Jeda 0.5 detik agar DOM selesai dimuat
}
