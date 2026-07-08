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

// Memuat data dari Memori Perangkat (Local Storage)
try { 
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

    cashierHistory.forEach(t => {
        if (t.tanggal === tglHariIni && !t.isPelunasan) {
            omzet += t.total || 0; laba += t.laba || 0; hpp += ((t.total || 0) - (t.laba || 0));
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

    let asetGudang = 0, totalJenisGudang = 0, countKritis = 0, countExpired = 0, stokGabungan = {};
    
    masterItems.forEach(b => {
        if (b.nama !== '___SYSTEM_AUTH___') {
            asetGudang += (b.modal || 0) * (b.stok || 0);
            if (!stokGabungan[b.dnaInduk]) { stokGabungan[b.dnaInduk] = 0; totalJenisGudang++; }
            stokGabungan[b.dnaInduk] += b.stok;

            if (b.expired) {
                let diffHari = Math.floor((new Date(b.expired) - new Date(tglHariIni)) / (1000 * 60 * 60 * 24));
                if (diffHari <= 30 && diffHari >= 0) countExpired++;
            }
        }
    });

    Object.values(stokGabungan).forEach(totalStok => { if (totalStok <= 2) countKritis++; });

    let asetEtalase = 0;
    etalaseItems.forEach(b => {
        if(b.antreanFIFO && b.antreanFIFO.length > 0) {
            b.antreanFIFO.forEach(fifo => { asetEtalase += ((fifo.modal || 0) * (fifo.stok || 0)); });
        } else {
            let masterNya = masterItems.find(m => m.dnaInduk === b.dnaInduk || m.nama === b.nama); 
            asetEtalase += (masterNya ? (masterNya.modal || 0) : 0) * (b.stok || 0);
        }
    });

    document.getElementById('berandaAset').textContent = rupiah(asetGudang + asetEtalase);
    document.getElementById('berandaJenisObat').textContent = `${totalJenisGudang} Obat Terdaftar`;

    let totalModalSiklus = siklusAktif.modalAwal + siklusAktif.modalTambahan;
    let selisihSiklus = siklusAktif.uangMasuk - totalModalSiklus;
    let elemenStatus = document.getElementById('berandaStatusSiklus');
    let elemenBar = document.getElementById('berandaProgressSiklus');
    let persen = totalModalSiklus === 0 ? 0 : Math.min((siklusAktif.uangMasuk / totalModalSiklus) * 100, 100);

    if (totalModalSiklus === 0 && siklusAktif.uangMasuk === 0) {
        elemenStatus.innerHTML = `Status: <span class="text-slate-500 font-bold">NOL</span>`;
        elemenBar.style.width = "0%"; elemenBar.className = "h-full bg-slate-300 w-[0%] rounded-full";
    } else if (selisihSiklus < 0) {
        elemenStatus.innerHTML = `Defisit: <span class="text-red-500 font-bold">-${rupiah(Math.abs(selisihSiklus))}</span>`;
        elemenBar.style.width = persen + "%"; elemenBar.className = "h-full bg-gradient-to-r from-red-500 to-amber-400 rounded-full transition-all duration-1000";
    } else {
        elemenStatus.innerHTML = `Surplus: <span class="text-emerald-500 font-bold">+${rupiah(selisihSiklus)}</span>`;
        elemenBar.style.width = "100%"; elemenBar.className = "h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000";
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
        wadah.innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm mt-4"><i class="fa-solid fa-box-open text-4xl text-slate-300 mb-3 block"></i><p class="font-bold text-slate-600">Tidak ada obat ditemukan.</p></div>`;
        return;
    }

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
        
        let isMulti = g.batches.length > 1;
        let stokWarna = g.totalStok <= 5 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100';
        let subTeks = g.varian ? `<p class="text-[10px] text-slate-500 italic mt-0.5 leading-tight">${g.varian}</p>` : '';
        
        let contentHtml = '';

        let generateBatchCard = (b, idx) => {
            let expTeks = b.expired ? b.expired : 'Tanpa Exp';
            let expColor = b.expired ? 'text-red-500' : 'text-slate-600';
            return `
            <div class="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex justify-between items-center">
                <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    BATCH ${idx+1} <span class="text-slate-300 mx-1">|</span> Exp: <span class="${expColor}">${expTeks}</span>
                </div>
                <div class="text-[10px] font-bold text-slate-600 tracking-wide">
                    Stok: <span class="text-emerald-600">${b.stok}</span> <span class="text-slate-300 mx-1">|</span> Beli: ${rupiah(b.modal)}
                </div>
            </div>`;
        };

        if (isMulti) {
            let batchHtml = g.batches.map((b, idx) => generateBatchCard(b, idx)).join('<div class="h-1.5"></div>');
            contentHtml = `
            <div class="flex mt-3">
                <div class="w-1.5 bg-[#10b981] rounded-full mr-2.5 shrink-0"></div>
                <div class="flex-1">
                    ${batchHtml}
                </div>
            </div>
            <div class="flex justify-between items-center bg-blue-50/60 rounded-xl p-3 mt-2.5 border border-blue-100">
                <span class="text-[10px] text-blue-800 font-bold uppercase tracking-wider">Harga Jual Global</span>
                <span class="text-base font-black text-blue-900">${rupiah(g.jual)}</span>
            </div>
            `;
        } else {
            let b = g.batches[0];
            contentHtml = `
            <div class="mt-3">
                ${generateBatchCard(b, 0)}
            </div>
            <div class="flex justify-between items-center bg-blue-50/60 rounded-xl p-3 mt-2.5 border border-blue-100">
                <span class="text-[10px] text-blue-800 font-bold uppercase tracking-wider">Harga Jual Global</span>
                <span class="text-base font-black text-blue-900">${rupiah(g.jual)}</span>
            </div>
            `;
        }

        return `
        <div class="bg-white border border-slate-200 rounded-[20px] p-4 shadow-sm flex flex-col mb-3">
            <div class="flex justify-between items-start">
                <div class="pr-2">
                    <h3 class="font-black text-slate-900 text-[15px] leading-tight mb-0.5">${g.nama}</h3>
                    ${subTeks}
                    <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">${g.kategori || 'Tanpa Kategori'}</p>
                </div>
                <div class="px-2 py-1 rounded-lg border ${stokWarna} flex items-center gap-1 shadow-sm shrink-0">
                    <i class="fa-solid fa-boxes-stacked text-[10px]"></i><span class="font-black text-xs">${g.totalStok}</span>
                </div>
            </div>
            ${contentHtml}
            <div class="flex gap-2 mt-3">
                <button onclick="bukaModalTransferMobile('${g.dnaInduk}')" class="flex-1 h-11 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-transform active:scale-95 shadow-sm">
                    <i class="fa-solid fa-truck-fast text-[11px]"></i> Ke Etalase
                </button>
                <button onclick="bukaModalEditMobile('${g.batches[0].idBatch}')" class="w-11 h-11 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm">
                    <i class="fa-solid fa-pen text-sm"></i>
                </button>
                <button onclick="bukaModalHapusCerdas('${g.dnaInduk}', '${g.nama}')" class="w-11 h-11 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl flex items-center justify-center transition-transform active:scale-95 border border-red-100 shadow-sm">
                    <i class="fa-solid fa-trash text-sm"></i>
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
    alert("🚚 " + inputQty + " " + namaObat + " berhasil dipindah ke Etalase!");
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
    document.getElementById('subTeksHeaderKunci').innerHTML = 'Mode Terkunci 🔒 (Ketuk untuk Edit)';
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
    document.getElementById('subTeksHeaderKunci').innerHTML = 'Mode Edit Aktif ✏️';
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

    if (isKulakanBaru || isAddingNewBatchMobile) {
        const idBatchBaru = 'B-' + Date.now() + '-' + Math.floor(Math.random()*1000);
        masterItems.unshift({ 
            idBatch: idBatchBaru, dnaInduk: referensi.dnaInduk, barcode: referensi.barcode, qrcode: referensi.qrcode,
            nama: nBaru, varian: vBaru, keterangan: '', kategori: kBaru, modal: mBaru, jual: jBaru, stok: isAddingNewBatchMobile ? sBaru : selisihStok, expired: expBaru 
        });
        
        let qtySuntikan = isAddingNewBatchMobile ? sBaru : selisihStok;
        siklusAktif.qtyTambahan += qtySuntikan; 
        siklusAktif.modalTambahan += (qtySuntikan * mBaru);
        if(!isAddingNewBatchMobile) alert("🪄 Sukses! Sistem otomatis merakitkan Batch Kulakan Baru di Gudang.");
    } else {
        siklusAktif.qtyTambahan += selisihStok; 
        siklusAktif.modalTambahan += (selisihStok * mBaru);
        barang.modal = mBaru; barang.jual = jBaru; barang.stok = sBaru; barang.expired = expBaru;
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
            tampilkanConfirmMobile("🪄 DETEKSI KULAKAN BARU:\n\nSistem melihat Anda menambah stok (+ " + selisihStok + " Box) sekaligus merubah Tgl Kedaluwarsa/Harga Modal.\n\nApakah ini barang Kulakan Baru? (Klik 'Ya, Lanjut' agar otomatis dibuatkan Batch/Kardus baru).", 
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
        localStorage.setItem('apotek_masterItems', JSON.stringify(masterItems));
        renderGudangMobile(document.getElementById('cariGudangMobile').value); renderBerandaMobile();
        alert(`✅ Obat ${namaObat} berhasil dihapus dari Gudang.`);
    });
}
// ==========================================
// 11. MESIN TAMBAH OBAT BARU
// ==========================================
function bukaModalTambahObatMobile() {
    document.getElementById('tambahBarcodeMobile').value = ''; document.getElementById('tambahQrcodeMobile').value = ''; 
    document.getElementById('tambahNamaMobile').value = ''; document.getElementById('tambahVarianMobile').value = '';
    document.getElementById('tambahKategoriMobile').value = ''; document.getElementById('tambahModalMobile').value = ''; 
    document.getElementById('tambahJualMobile').value = ''; document.getElementById('tambahStokMobile').value = ''; 
    document.getElementById('tambahExpiredMobile').value = '';
    bukaModalMobile('modalTambahObatMobile', 'panelTambahObatMobile');
}

function prosesSimpanObatBaruMobile() {
    const barcode = document.getElementById('tambahBarcodeMobile').value.trim(); const qrcode = document.getElementById('tambahQrcodeMobile').value.trim(); 
    const nama = document.getElementById('tambahNamaMobile').value.trim(); const varian = document.getElementById('tambahVarianMobile').value.trim(); 
    const kategori = document.getElementById('tambahKategoriMobile').value.trim(); const modal = parseInt(document.getElementById('tambahModalMobile').value); 
    const jual = parseInt(document.getElementById('tambahJualMobile').value); const stok = parseInt(document.getElementById('tambahStokMobile').value); 
    const expired = document.getElementById('tambahExpiredMobile').value;

    if(!nama || !kategori || isNaN(modal) || isNaN(jual) || isNaN(stok)) return alert('⚠️ Wajib diisi: Nama, Kategori, Modal, Jual, dan Stok!');
    if(modal >= jual) return alert('⚠️ Peringatan: Harga Jual harus lebih tinggi dari Modal/HPP.');
    
    const idBatch = 'B-' + Date.now(); 
    let dnaInduk = '';
    if (qrcode) { dnaInduk = qrcode; } else if (barcode) { dnaInduk = barcode; } 
    else {
        let cekGudang = masterItems.find(m => m.nama.toLowerCase() === nama.toLowerCase());
        if (cekGudang && cekGudang.dnaInduk) { dnaInduk = cekGudang.dnaInduk; } else { dnaInduk = 'DNA-' + Date.now(); }
    }

    masterItems.unshift({ idBatch, dnaInduk, barcode, qrcode, nama, varian, keterangan: '', kategori, modal, jual, stok, expired });
    let nilaiSuntikan = modal * stok;
    if (siklusAktif.qtyAwal === 0 && siklusAktif.qtyTambahan === 0) { siklusAktif.modalAwal += nilaiSuntikan; siklusAktif.qtyAwal += stok; } 
    else { siklusAktif.modalTambahan += nilaiSuntikan; siklusAktif.qtyTambahan += stok; }

    localStorage.setItem('apotek_masterItems', JSON.stringify(masterItems)); localStorage.setItem('apotek_siklusAktif', JSON.stringify(siklusAktif));
    tutupModalMobile('modalTambahObatMobile'); renderGudangMobile(document.getElementById('cariGudangMobile').value); renderBerandaMobile();
    alert('✅ Sukses! ' + nama + ' berhasil ditambahkan ke Gudang.');
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
        tbody.innerHTML = `<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-cart-arrow-down text-3xl mb-2 opacity-50"></i><p class="text-xs font-semibold">Keranjang kosong</p></div>`;
    } else {
        tbody.innerHTML = keranjangKasirMobile.map((k, i) => {
            let sub = k.jual * k.qty; total += sub;
            let ketTeks = (k.varian || k.keterangan) ? `<p class="text-[9px] text-slate-500 italic mt-0.5">${k.varian || ''} ${k.keterangan || ''}</p>` : '';
            return `<div class="p-3 bg-white flex items-center justify-between gap-2"><div class="flex-1 pr-2"><h4 class="font-bold text-slate-800 text-xs leading-tight">${k.nama}</h4>${ketTeks}<p class="font-black text-corporate-600 text-sm mt-1">${rupiah(sub)}</p></div><div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-inner shrink-0"><button onclick="ubahQtyKeranjangMobile(${i}, -1)" class="w-7 h-7 rounded-lg bg-white shadow text-slate-600 font-bold active:bg-slate-100 transition">-</button><span class="w-4 text-center font-bold text-slate-800 text-xs">${k.qty}</span><button onclick="ubahQtyKeranjangMobile(${i}, 1)" class="w-7 h-7 rounded-lg bg-emerald-50 shadow text-emerald-600 font-bold active:bg-emerald-100 transition">+</button></div></div>`;
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

    localStorage.setItem('apotek_etalaseItems', JSON.stringify(etalaseItems)); localStorage.setItem('apotek_cashierHistory', JSON.stringify(cashierHistory)); localStorage.setItem('apotek_siklusAktif', JSON.stringify(siklusAktif));
    tutupModalMobile('modalKasirMobile'); renderBerandaMobile(); 
    if(!document.getElementById('layar-gudang').classList.contains('hidden')) renderGudangMobile(document.getElementById('cariGudangMobile').value);
    if(!document.getElementById('layar-etalase').classList.contains('hidden')) renderEtalaseMobile();
    try { if (navigator.vibrate) navigator.vibrate([100, 50, 100]); } catch (e) {}
    alert(`✅ Transaksi ${metode} Berhasil! Omzet telah masuk ke Beranda.`);
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
                        etalaseItems.push({ dnaInduk: 'DNA-RETUR-' + Date.now(), nama: itemRetur.nama, kategori: '⚠️ Barang Retur', jual: itemRetur.jual, stok: itemRetur.qty, antreanFIFO: [{ idBatch: idBatchRetur, modal: itemRetur.hppSatuan || (itemRetur.jual * 0.8), stok: itemRetur.qty, expired: '' }] }); 
                    }
                });
            } else { 
                let qty = trx.item || 1; let hppRetur = Math.round(((trx.total || 0) - (trx.laba || 0)) / qty);
                etalaseItems.push({ dnaInduk: 'DNA-RETUR-OLD', nama: trx.obat, kategori: '⚠️ Barang Retur', jual: Math.round((trx.total || 0) / qty), stok: qty, antreanFIFO: [{ idBatch: 'RETUR-OLD', modal: hppRetur, stok: qty, expired: '' }] });
            }
            
            cashierHistory = cashierHistory.filter(t => t.id !== idTransaksi);
            localStorage.setItem('apotek_etalaseItems', JSON.stringify(etalaseItems)); localStorage.setItem('apotek_cashierHistory', JSON.stringify(cashierHistory)); localStorage.setItem('apotek_siklusAktif', JSON.stringify(siklusAktif));
            renderRiwayatMobile(); renderBerandaMobile(); alert("✅ Transaksi Dibatalkan. Stok setiap item diretur ke Etalase.");
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
    const pesanTeks = `Halo Bapak/Ibu *${trx.pelanggan || 'Pelanggan'}*,\n\nKami dari *${profilApotek.nama}* memohon izin mengingatkan catatan kasbon/piutang yang belum diselesaikan.\n*(Struk Terlampir)*\n\nMohon kerjasamanya untuk dapat melakukan pelunasan di tempat kami.\nTerima kasih! 🙏`;

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
        alert("🚚 Barang berhasil diberangkatkan ke Etalase secara Cerdas!");
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
    localStorage.setItem('apotek_profilData', JSON.stringify(profilApotek));
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
            if(match && match[1]) { document.getElementById('inputLacakIDMobile').value = match[1]; prosesLacakIDMobile(); } else { alert("⚠️ QR Code bukan struk valid."); }
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
    
    if (strPesan.includes('berhasil') || strPesan.includes('sukses') || strPesan.includes('✅')) {
        icon.className = 'w-16 h-16 mx-auto rounded-full bg-emerald-100 border-2 border-emerald-200 text-emerald-500 flex items-center justify-center text-3xl mb-3 shadow-inner'; icon.innerHTML = '<i class="fa-solid fa-check-circle"></i>';
        judul.className = 'font-black text-emerald-700 text-xl tracking-tight mb-2'; judul.innerText = 'Sukses!'; btn.className = 'w-full bg-emerald-500 text-white font-bold py-3.5 rounded-2xl shadow-md transition-transform active:scale-95';
    } else if (strPesan.includes('gagal') || strPesan.includes('wajib') || strPesan.includes('peringatan') || strPesan.includes('⚠️')) {
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
            localStorage.setItem('apotek_cashierHistory', JSON.stringify(cashierHistory)); localStorage.setItem('apotek_siklusAktif', JSON.stringify(siklusAktif));
            tutupModalMobile('modalPelunasanMobile'); renderPiutangMobile(); renderBerandaMobile();
            try { if (navigator.vibrate) navigator.vibrate([100, 50, 100]); } catch (e) {}
            alert(`✅ Pelunasan Sukses! Utang ditutup dan omzet bertambah.`);
        }
    }
}

function eksekusiTutupBukuMobile() {
    tampilkanConfirmMobile("Apakah Anda yakin ingin Tutup Buku?\n\nSiklus modal akan direset dan aset barang saat ini akan dijadikan patokan Modal Awal yang baru.", function() {
        let asetGudang = 0; let qtyGudang = 0;
        masterItems.filter(i => i.nama !== '___SYSTEM_AUTH___').forEach(b => { asetGudang += (b.modal || 0) * (b.stok || 0); qtyGudang += (b.stok || 0); });
        let asetEtalase = 0; let qtyEtalase = 0;
        etalaseItems.forEach(b => {
            let totalModalBatchIni = 0;
            if(b.antreanFIFO && b.antreanFIFO.length > 0) { b.antreanFIFO.forEach(fifo => { totalModalBatchIni += ((fifo.modal || 0) * (fifo.stok || 0)); }); } 
            else { let masterNya = masterItems.find(m => m.dnaInduk === b.dnaInduk || m.nama === b.nama); totalModalBatchIni = (masterNya ? (masterNya.modal || 0) : 0) * (b.stok || 0); }
            asetEtalase += totalModalBatchIni; qtyEtalase += (b.stok || 0);
        });
        siklusAktif = { modalAwal: asetGudang + asetEtalase, qtyAwal: qtyGudang + qtyEtalase, modalTambahan: 0, qtyTambahan: 0, uangMasuk: 0, tanggalStart: getTanggalLokal() };
        localStorage.setItem('apotek_siklusAktif', JSON.stringify(siklusAktif));
        renderBerandaMobile(); alert("✅ TUTUP BUKU BERHASIL! Progress Bar kembali nol dan siap untuk siklus baru.");
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
        
        alert("✅ Sistem berhasil dibersihkan sampai ke akarnya! Memuat ulang..."); 
        setTimeout(() => { window.location.reload(); }, 1200); 
    }); 
}

// ==========================================
// 22. INISIALISASI SAAT APLIKASI DIBUKA
// ==========================================
window.onload = () => { 
    try { 
        let p = JSON.parse(localStorage.getItem('apotek_profilData')); 
        if(p) { 
            profilApotek = p; 
            document.getElementById('namaApotekHeader').innerText = p.nama; 
            document.getElementById('setNamaMobile').value = p.nama; 
        } 
    } catch(e) {}
    renderBerandaMobile(); 
};
