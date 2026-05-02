/* =============================================
   ARHAM TRADERS — SUPABASE CLIENT & SYNC LAYER
   js/supabase-client.js

   HOW IT WORKS:
   1. Intercepts ALL DOMContentLoaded registrations from module files
   2. Shows loading overlay
   3. Syncs data from Supabase → localStorage
   4. Patches DB.add / DB.update / DB.remove to also write to Supabase
   5. Runs all queued module init handlers
   → No changes needed in any other JS file
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
     LOADING OVERLAY
     =========================================== */
  function _showOverlay() {
    if (document.getElementById('_atSbOv')) return;
    const ov = document.createElement('div');
    ov.id = '_atSbOv';
    ov.innerHTML = `
      <style>
        #_atSbOv {
          position: fixed; inset: 0;
          background: #181c2a;
          z-index: 999999;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 16px;
          font-family: 'Segoe UI', sans-serif;
        }
        #_atSbOv .at-sp {
          width: 48px; height: 48px; border-radius: 50%;
          border: 4px solid rgba(42,157,143,.2);
          border-top-color: #2a9d8f;
          animation: _atSpin .75s linear infinite;
        }
        @keyframes _atSpin { to { transform: rotate(360deg); } }
        #_atSbOv .at-ov-title { color: #fff; font-size: 15px; font-weight: 700; margin: 0; }
        #_atSbOv .at-ov-sub   { color: rgba(255,255,255,.4); font-size: 12px; margin: 0; }
        #_atSbOv .at-brand    {
          display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
        }
        #_atSbOv .at-brand-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: linear-gradient(135deg, #2a9d8f, #264653);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; color: #fff;
        }
        #_atSbOv .at-brand-name { color: #fff; font-size: 16px; font-weight: 800; }
        #_atSbOv .at-brand-sub  { color: rgba(255,255,255,.5); font-size: 11px; }
      </style>
      <div class="at-brand">
        <div class="at-brand-icon">&#128142;</div>
        <div>
          <div class="at-brand-name">Arham Traders</div>
          <div class="at-brand-sub">Management System</div>
        </div>
      </div>
      <div class="at-sp"></div>
      <p class="at-ov-title" id="_atSbMsg">Connecting to database...</p>
      <p class="at-ov-sub">Please wait</p>`;
    document.body.appendChild(ov);
  }

  function _hideOverlay() {
    document.getElementById('_atSbOv')?.remove();
  }

  function _setMsg(msg) {
    const el = document.getElementById('_atSbMsg');
    if (el) el.textContent = msg;
  }

  /* ===========================================
     SYNC: Supabase → localStorage
     =========================================== */
  async function _syncFromSupabase() {
    if (!_supa) return;
    try {
      _setMsg('Syncing data...');
      const results = await Promise.all(
        _ALL_KEYS.map(key =>
          _supa
            .from('at_store')
            .select('item_data')
            .eq('store_key', key)
            .then(({ data, error }) => ({ key, data, error }))
        )
      );
      results.forEach(({ key, data, error }) => {
        if (error) {
          console.warn('[Supabase] Sync error for', key, ':', error.message);
          return;
        }
        if (data && data.length > 0) {
          const items = data.map(row => row.item_data);
          localStorage.setItem('at_' + key, JSON.stringify(items));
        }
      });
      _setMsg('Data ready!');
    } catch (e) {
      console.warn('[Supabase] Sync failed (offline? using local data):', e);
    }
  }

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
    /* 1. Show overlay immediately */
    _showOverlay();

    /* 2. Sync from Supabase */
    await _syncFromSupabase();

    /* 3. Patch DB writes */
    _patchDB();

    /* 4. Restore original addEventListener */
    EventTarget.prototype.addEventListener = _origProto;

    /* 5. Small delay so "Data ready!" message shows briefly */
    await new Promise(r => setTimeout(r, 180));

    /* 6. Hide overlay */
    _hideOverlay();

    /* 7. Run all queued module DOMContentLoaded handlers */
    const evt = new Event('DOMContentLoaded');
    _dclQueue.forEach(handler => {
      try { handler(evt); } catch (e) { console.error('[Module init error]', e); }
    });
  });

})();
