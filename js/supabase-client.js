/* =============================================
   ARHAM TRADERS — SUPABASE CLIENT & SYNC LAYER
   js/supabase-client.js
   ============================================= */

(function () {
  'use strict';

  const _SB_URL = 'https://eelpyqlpqcbopoalbbux.supabase.co';
  const _SB_KEY = 'sb_publishable_trETxzapymLkrxEX0pSGyA_PM4I12HA';

  /* All localStorage keys used by the app */
  const _ALL_KEYS = [
    'suppliers', 'bookings', 'warehouse', 'production',
    'finished_goods', 'deliveries',
    'sf_payments',
    'vendors', 'vendor_expenses', 'vendor_payments', 'vendor_monthly_closings',
    'income', 'expenses', 'monthly_closings'
  ];

  /* ---- Init Supabase client ---- */
  let _supa = null;
  try {
    if (window.supabase && window.supabase.createClient) {
      _supa = window.supabase.createClient(_SB_URL, _SB_KEY);
    }
  } catch (e) {
    console.warn('[Supabase] Init failed:', e);
  }


  /* ===========================================
     SYNC: Bi-directional merge
     - Local items missing from Supabase → push to Supabase
     - Supabase items missing from local  → pull to localStorage
     =========================================== */
  async function _syncFromSupabase() {
    if (!_supa) return;
    try {
      const results = await Promise.all(
        _ALL_KEYS.map(key =>
          _supa
            .from('at_store')
            .select('item_id, item_data')
            .eq('store_key', key)
            .then(({ data, error }) => ({ key, data: data || [], error }))
        )
      );

      for (const { key, data, error } of results) {
        if (error) {
          console.warn('[Supabase] Sync error for', key, ':', error.message);
          continue;
        }

        /* --- Build maps --- */
        const localItems  = (() => {
          try { return JSON.parse(localStorage.getItem('at_' + key)) || []; }
          catch { return []; }
        })();

        const remoteMap = {};
        data.forEach(row => { remoteMap[String(row.item_id)] = row.item_data; });

        const localMap  = {};
        localItems.forEach(item => { if (item && item.id) localMap[String(item.id)] = item; });

        /* --- Push local-only items to Supabase --- */
        const toUpsert = localItems.filter(item => item && item.id && !remoteMap[String(item.id)]);
        if (toUpsert.length > 0) {
          const rows = toUpsert.map(item => ({
            store_key:  key,
            item_id:    String(item.id),
            item_data:  item,
            updated_at: new Date().toISOString()
          }));
          const { error: upErr } = await _supa
            .from('at_store')
            .upsert(rows, { onConflict: 'store_key,item_id' });
          if (upErr) console.warn('[SB push local→remote]', key, upErr.message);
        }

        /* --- Merge remote-only items into localStorage --- */
        const remoteOnly = data.filter(row => !localMap[String(row.item_id)]);
        if (remoteOnly.length > 0) {
          remoteOnly.forEach(row => {
            if (row.item_data && row.item_data.id) {
              localMap[String(row.item_data.id)] = row.item_data;
            }
          });
          const merged = Object.values(localMap);
          localStorage.setItem('at_' + key, JSON.stringify(merged));
        }
      }
    } catch (e) {
      console.warn('[Supabase] Sync failed (offline? using local data):', e);
    }
  }

  /* ===========================================
     MANUAL SYNC BUTTON handler
     =========================================== */
  window.syncNow = async function () {
    const btn = document.getElementById('sbSyncBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    await _syncFromSupabase();
    if (window.showToast) showToast('Sync complete! Reloading...', 'success');
    setTimeout(() => location.reload(), 900);
  };

  /* ===========================================
     PATCH DB: writes also go to Supabase
     =========================================== */
  function _patchDB() {
    if (!_supa || !window.DB) return;

    const _oAdd    = DB.add.bind(DB);
    const _oUpdate = DB.update.bind(DB);
    const _oRemove = DB.remove.bind(DB);

    DB.add = function (key, item) {
      const result = _oAdd(key, item);
      _supa.from('at_store').upsert({
        store_key:  key,
        item_id:    String(result.id),
        item_data:  result,
        updated_at: new Date().toISOString()
      }, { onConflict: 'store_key,item_id' })
      .then(({ error }) => { if (error) console.warn('[SB write]', error.message); });
      return result;
    };

    DB.update = function (key, id, updates) {
      const result = _oUpdate(key, id, updates);
      if (result) {
        _supa.from('at_store').upsert({
          store_key:  key,
          item_id:    String(id),
          item_data:  result,
          updated_at: new Date().toISOString()
        }, { onConflict: 'store_key,item_id' })
        .then(({ error }) => { if (error) console.warn('[SB update]', error.message); });
      }
      return result;
    };

    DB.remove = function (key, id) {
      _oRemove(key, id);
      _supa.from('at_store').delete()
        .eq('store_key', key)
        .eq('item_id', String(id))
        .then(({ error }) => { if (error) console.warn('[SB delete]', error.message); });
    };
  }

  /* ===========================================
     INTERCEPT DOMContentLoaded
     Queue all handlers from module files, run
     them AFTER Supabase sync completes.
     =========================================== */
  const _dclQueue  = [];
  const _origProto = EventTarget.prototype.addEventListener;

  /* Override addEventListener on EventTarget.prototype */
  EventTarget.prototype.addEventListener = function (type, handler, opts) {
    if (type === 'DOMContentLoaded' && this === document) {
      _dclQueue.push(handler);
      return;
    }
    return _origProto.call(this, type, handler, opts);
  };

  /* Register OUR real DOMContentLoaded using the original method */
  _origProto.call(document, 'DOMContentLoaded', async function () {
    /* 1. Sync from Supabase (silent, no overlay) */
    await _syncFromSupabase();

    /* 2. Patch DB writes */
    _patchDB();

    /* 3. Restore original addEventListener */
    EventTarget.prototype.addEventListener = _origProto;

    /* 4. Run all queued module DOMContentLoaded handlers */
    const evt = new Event('DOMContentLoaded');
    _dclQueue.forEach(handler => {
      try { handler(evt); } catch (e) { console.error('[Module init error]', e); }
    });
  });

})();
