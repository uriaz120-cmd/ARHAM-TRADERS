/* =============================================
   ARHAM TRADERS — SUPABASE CLIENT (Cloud-Only)
   js/supabase-client.js
   
   Architecture: Supabase is the ONLY data source.
   On page load → fetch all data from cloud into memory.
   All writes (add/update/delete) → directly to cloud + memory.
   No localStorage used for data. Delete = permanently gone.
   ============================================= */

(function () {
  'use strict';

  const _SB_URL = 'https://eelpyqlpqcbopoalbbux.supabase.co';
  const _SB_KEY = 'sb_publishable_trETxzapymLkrxEX0pSGyA_PM4I12HA';

  /* All data keys used by the app */
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
     Expose helper for remote cleanup (Delete All Data)
     =========================================== */
  window.supabaseClearRemoteData = async function (keys) {
    if (!_supa) return { error: { message: 'Supabase client not initialized' } };
    try {
      const targetKeys = Array.isArray(keys) ? keys : _ALL_KEYS;
      const { error } = await _supa
        .from('at_store')
        .delete()
        .in('store_key', targetKeys);
      /* Also clear in-memory store */
      targetKeys.forEach(k => { if (window._memStore) window._memStore[k] = []; });
      return { error };
    } catch (e) {
      return { error: { message: e.message || String(e) } };
    }
  };

  /* ===========================================
     LOAD: Fetch ALL data from Supabase into memory
     This is the ONLY data source — no localStorage
     =========================================== */
  async function _loadFromSupabase() {
    if (!_supa) {
      console.warn('[Supabase] Client not available — app will run with empty data');
      return;
    }
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
          console.warn('[Supabase] Load error for', key, ':', error.message);
          continue;
        }

        /* Load cloud data directly into memory */
        const items = [];
        data.forEach(row => {
          if (row.item_data && row.item_data.id) {
            items.push(row.item_data);
          }
        });
        window._memStore[key] = items;
      }

      /* Clean up any old localStorage data (migration) */
      _ALL_KEYS.forEach(k => {
        localStorage.removeItem('at_' + k);
        localStorage.removeItem('at_deleted_' + k);
      });

      console.log('[Supabase] ✅ All data loaded from cloud into memory');
    } catch (e) {
      console.warn('[Supabase] Load failed (check internet):', e);
      if (window.showToast) {
        showToast('⚠️ Internet connection required to load data!', 'error', 5000);
      }
    }
  }

  /* ===========================================
     MANUAL SYNC / REFRESH BUTTON handler
     =========================================== */
  window.syncNow = async function () {
    const btn = document.getElementById('sbSyncBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    await _loadFromSupabase();
    if (window.showToast) showToast('Data refreshed from cloud! Reloading...', 'success');
    setTimeout(() => location.reload(), 900);
  };

  /* ===========================================
     PATCH DB: All writes go DIRECTLY to Supabase
     Memory is updated instantly for fast UI response
     =========================================== */
  function _patchDB() {
    if (!_supa || typeof DB === 'undefined') return;

    const _oAdd    = DB.add.bind(DB);
    const _oUpdate = DB.update.bind(DB);
    const _oRemove = DB.remove.bind(DB);

    DB.add = function (key, item) {
      /* Add to memory first (instant UI response) */
      const result = _oAdd(key, item);
      /* Then persist to Supabase cloud */
      _supa.from('at_store').upsert({
        store_key:  key,
        item_id:    String(result.id),
        item_data:  result,
        updated_at: new Date().toISOString()
      }, { onConflict: 'store_key,item_id' })
      .then(({ error }) => {
        if (error) {
          console.warn('[Cloud write failed]', error.message);
          if (window.showToast) showToast('⚠️ Cloud save failed: ' + error.message, 'warning');
        }
      });
      return result;
    };

    DB.update = function (key, id, updates) {
      /* Update memory first */
      const result = _oUpdate(key, id, updates);
      if (result) {
        /* Then persist to Supabase cloud */
        _supa.from('at_store').upsert({
          store_key:  key,
          item_id:    String(id),
          item_data:  result,
          updated_at: new Date().toISOString()
        }, { onConflict: 'store_key,item_id' })
        .then(({ error }) => {
          if (error) {
            console.warn('[Cloud update failed]', error.message);
            if (window.showToast) showToast('⚠️ Cloud update failed: ' + error.message, 'warning');
          }
        });
      }
      return result;
    };

    DB.remove = function (key, id) {
      /* Remove from memory first (instant UI) */
      _oRemove(key, id);
      /* Delete from Supabase cloud — PERMANENTLY GONE */
      _supa.from('at_store').delete()
        .eq('store_key', key)
        .eq('item_id', String(id))
        .then(({ error }) => {
          if (error) {
            console.warn('[Cloud delete failed]', error.message);
            if (window.showToast) showToast('⚠️ Cloud delete failed, retrying...', 'warning');
            /* Retry once after 2 seconds */
            setTimeout(() => {
              _supa.from('at_store').delete()
                .eq('store_key', key)
                .eq('item_id', String(id))
                .then(({ error: e2 }) => {
                  if (e2) console.warn('[Cloud delete retry failed]', e2.message);
                });
            }, 2000);
          }
        });
    };
  }

  /* ===========================================
     INTERCEPT DOMContentLoaded
     Queue all handlers from module files, run
     them AFTER cloud data is loaded.
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

  /* Register OUR real DOMContentLoaded handler */
  async function _initApp() {
    /* 1. Load ALL data from Supabase cloud into memory */
    await _loadFromSupabase();

    /* 2. Patch DB writes to go to cloud */
    _patchDB();

    /* 3. Restore original addEventListener */
    EventTarget.prototype.addEventListener = _origProto;

    /* 4. Run all queued module DOMContentLoaded handlers */
    const evt = new Event('DOMContentLoaded');
    _dclQueue.forEach(handler => {
      try { handler(evt); } catch (e) { console.error('[Module init error]', e); }
    });
  }

  if (document.readyState === 'loading') {
    _origProto.call(document, 'DOMContentLoaded', _initApp);
  } else {
    /* DOM is already ready, run immediately */
    _initApp();
  }

})();
