const weddingResponseLimits = Object.freeze({
    guestName: 80,
    wishMessage: 1500,
    maximumGuestCount: 2,
    visibleWishes: 50
});

function decodeLegacyAnonRole(key) {
    if (!key || key.split('.').length !== 3) return '';
    try {
        const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
        return JSON.parse(atob(padded)).role || '';
    } catch {
        return '';
    }
}

function createWeddingResponseStore() {
    const config = window.weddingSupabaseConfig || {};
    const url = typeof config.url === 'string' ? config.url.trim() : '';
    const anonKey = typeof config.anonKey === 'string' ? config.anonKey.trim() : '';
    const usesPlaceholder = !url || !anonKey || /YOUR[-_ ]|PLACEHOLDER/i.test(`${url} ${anonKey}`);
    let validUrl = false;

    try {
        validUrl = new URL(url).protocol === 'https:';
    } catch {
        validUrl = false;
    }

    const safePublicKey = anonKey.startsWith('sb_publishable_') || decodeLegacyAnonRole(anonKey) === 'anon';
    if (usesPlaceholder || !validUrl || !safePublicKey ||
        !window.supabase || typeof window.supabase.createClient !== 'function') {
        return { ready: false };
    }

    const client = window.supabase.createClient(url, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });

    return {
        ready: true,
        async saveRsvp(record) {
            const { error } = await client.from('wedding_rsvp').insert({
                guest_name: record.guestName,
                attendance: record.attendance,
                guest_count: record.guestCount,
                message: null
            });
            if (error) throw error;
        },
        async listWishes() {
            const { data, error } = await client
                .from('wedding_wishes')
                .select('id, guest_name, message, created_at')
                .order('created_at', { ascending: false })
                .limit(weddingResponseLimits.visibleWishes);
            if (error) throw error;
            return Array.isArray(data) ? data : [];
        },
        async addWish(record) {
            const { error } = await client.from('wedding_wishes').insert({
                guest_name: record.guestName,
                message: record.message
            });
            if (error) throw error;
        }
    };
}

document.addEventListener('DOMContentLoaded', function () {
    const rsvpForm = document.getElementById('rsvpForm');
    const wishForm = document.getElementById('wishForm');
    if (!rsvpForm || !wishForm) return;

    const responseStore = createWeddingResponseStore();
    const attendance = document.getElementById('attendance');
    const count = document.getElementById('guestCount');
    const rsvpName = document.getElementById('rsvpName');
    const wishName = document.getElementById('wishName');
    const message = document.getElementById('wishMessage');
    const guest = document.getElementById('guestName');
    const rsvpButton = rsvpForm.querySelector('button[type="submit"]');
    const wishButton = wishForm.querySelector('button[type="submit"]');
    const rsvpButtonLabel = rsvpButton.textContent;
    const wishButtonLabel = wishButton.textContent;

    if (guest && guest.textContent.trim() !== 'Tamu Undangan') {
        rsvpName.value = guest.textContent.trim().slice(0, weddingResponseLimits.guestName);
        wishName.value = guest.textContent.trim().slice(0, weddingResponseLimits.guestName);
    }

    function feedback(id, text, state) {
        const target = document.getElementById(id);
        target.textContent = text;
        target.dataset.state = state;
    }

    function normalizeText(value) {
        return value.trim().replace(/\s+/g, ' ');
    }

    function validateTextInput(input, maximumLength) {
        const value = normalizeText(input.value);
        if (!value) {
            input.setCustomValidity('Mohon isi bagian ini.');
            return false;
        }
        if (value.length > maximumLength) {
            input.setCustomValidity(`Maksimal ${maximumLength} karakter.`);
            return false;
        }
        input.setCustomValidity('');
        return true;
    }

    function updateCount() {
        const attending = attendance.value === 'attending';
        document.getElementById('guestCountField').hidden = !attending;
        count.disabled = !attending;
        count.required = attending;
        if (!attending) count.value = '';
    }

    function setSubmitting(form, button, label, submitting) {
        form.setAttribute('aria-busy', String(submitting));
        button.disabled = submitting || !responseStore.ready;
        button.textContent = submitting ? 'Mengirim…' : label;
    }

    function renderWishes(records) {
        const list = document.getElementById('wishList');
        const empty = document.getElementById('wishEmpty');
        list.replaceChildren();
        empty.hidden = records.length > 0;

        records.forEach(record => {
            if (!record || typeof record.guest_name !== 'string' || typeof record.message !== 'string') return;
            const createdAt = typeof record.created_at === 'string' ? record.created_at : '';
            const item = document.createElement('li');
            const name = document.createElement('h3');
            const text = document.createElement('p');
            const timestamp = document.createElement('time');

            name.textContent = record.guest_name.slice(0, weddingResponseLimits.guestName);
            text.textContent = record.message.slice(0, weddingResponseLimits.wishMessage);
            if (createdAt && Number.isFinite(Date.parse(createdAt))) {
                timestamp.dateTime = createdAt;
                timestamp.textContent = new Date(createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric'
                });
            }
            item.append(name, text);
            if (timestamp.textContent) item.append(timestamp);
            list.append(item);
        });
    }

    async function refreshWishes() {
        const empty = document.getElementById('wishEmpty');
        empty.textContent = 'Memuat ucapan…';
        empty.hidden = false;
        const records = await responseStore.listWishes();
        empty.textContent = 'Belum ada ucapan. Tuliskan doa pertama untuk perjalanan kami.';
        renderWishes(records);
    }

    attendance.addEventListener('change', updateCount);
    updateCount();

    [
        [rsvpName, weddingResponseLimits.guestName],
        [wishName, weddingResponseLimits.guestName],
        [message, weddingResponseLimits.wishMessage]
    ].forEach(([input, maximumLength]) => {
        const validate = () => validateTextInput(input, maximumLength);
        input.addEventListener('input', validate);
        input.addEventListener('blur', validate);
        validate();
    });

    [rsvpForm, wishForm].forEach(form => {
        form.addEventListener('invalid', () => {
            feedback(form === rsvpForm ? 'rsvpFeedback' : 'wishFeedback',
                'Mohon lengkapi isian yang wajib diisi.', 'error');
        }, true);
    });

    if (!responseStore.ready) {
        rsvpButton.disabled = true;
        wishButton.disabled = true;
        document.getElementById('localNotice').textContent = 'Layanan RSVP belum dikonfigurasi. Konfirmasi belum dapat dikirim.';
        document.getElementById('wishNotice').textContent = 'Layanan Ucapan & Doa belum dikonfigurasi. Ucapan belum dapat dikirim.';
        document.getElementById('wishEmpty').textContent = 'Daftar ucapan akan tersedia setelah backend wedding dikonfigurasi.';
        return;
    }

    document.getElementById('localNotice').textContent = 'Konfirmasi Anda akan dikirim langsung kepada Puteri & Ilham.';
    document.getElementById('wishNotice').textContent = 'Ucapan akan tampil setelah berhasil tersimpan.';

    rsvpForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        validateTextInput(rsvpName, weddingResponseLimits.guestName);
        if (!rsvpForm.checkValidity()) {
            rsvpForm.reportValidity();
            feedback('rsvpFeedback', 'Mohon lengkapi isian yang wajib diisi.', 'error');
            return;
        }

        const attendanceValue = attendance.value;
        const guestCount = attendanceValue === 'attending' ? Number(count.value) : null;
        const validGuestCount = attendanceValue !== 'attending' ||
            (Number.isInteger(guestCount) && guestCount >= 1 && guestCount <= weddingResponseLimits.maximumGuestCount);
        if (!['attending', 'not-attending'].includes(attendanceValue) || !validGuestCount) {
            feedback('rsvpFeedback', 'Pilihan kehadiran atau jumlah tamu belum valid.', 'error');
            return;
        }

        setSubmitting(rsvpForm, rsvpButton, rsvpButtonLabel, true);
        feedback('rsvpFeedback', 'Mengirim konfirmasi…', 'pending');
        try {
            await responseStore.saveRsvp({
                guestName: normalizeText(rsvpName.value),
                attendance: attendanceValue,
                guestCount
            });
            feedback('rsvpFeedback', 'Konfirmasi kehadiran berhasil dikirim kepada Puteri & Ilham.', 'success');
        } catch (error) {
            console.error('Wedding RSVP request failed.', error);
            feedback('rsvpFeedback', 'Konfirmasi belum berhasil dikirim. Periksa koneksi lalu coba lagi.', 'error');
        } finally {
            setSubmitting(rsvpForm, rsvpButton, rsvpButtonLabel, false);
        }
    });

    wishForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        validateTextInput(wishName, weddingResponseLimits.guestName);
        validateTextInput(message, weddingResponseLimits.wishMessage);
        if (!wishForm.checkValidity()) {
            wishForm.reportValidity();
            feedback('wishFeedback', 'Mohon lengkapi isian yang wajib diisi.', 'error');
            return;
        }

        setSubmitting(wishForm, wishButton, wishButtonLabel, true);
        feedback('wishFeedback', 'Mengirim ucapan…', 'pending');
        try {
            await responseStore.addWish({
                guestName: normalizeText(wishName.value),
                message: normalizeText(message.value)
            });
            await refreshWishes();
            message.value = '';
            message.setCustomValidity('Mohon isi bagian ini.');
            feedback('wishFeedback', 'Ucapan berhasil dikirim. Terima kasih atas doa baik Anda.', 'success');
        } catch (error) {
            console.error('Wedding wish request failed.', error);
            feedback('wishFeedback', 'Ucapan belum berhasil dikirim. Teks Anda tetap tersedia untuk dicoba kembali.', 'error');
        } finally {
            setSubmitting(wishForm, wishButton, wishButtonLabel, false);
        }
    });

    refreshWishes().catch(error => {
        console.error('Wedding wishes could not be loaded.', error);
        document.getElementById('wishEmpty').textContent = 'Daftar ucapan belum dapat dimuat. Silakan coba lagi.';
        document.getElementById('wishEmpty').hidden = false;
        feedback('wishFeedback', 'Daftar ucapan belum dapat dimuat. Belum ada data yang diubah.', 'error');
    });
});
