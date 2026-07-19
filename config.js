"use strict";

(() => {
  const config = Object.freeze({
    supabaseUrl: "https://mxboguiriifkmsmcusjt.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14Ym9ndWlyaWlma21zbWN1c2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNDE5NzMsImV4cCI6MjA5OTYxNzk3M30.QAG5eGfOfZkSoL_mB55AVEgoQn4ZHAaQavD4yVt0zAM",
    storageBucket: "kennel-screenshots",
    appVersion: "5.0.1"
  });

  let client = null;

  function getSupabaseClient() {
    if (client) return client;
    if (!window.supabase?.createClient) {
      throw new Error("Supabase failed to load. Refresh the page or disable any script blocker.");
    }
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    return client;
  }

  window.KUBROW_CONFIG = config;
  window.KubrowApp = Object.freeze({ config, getSupabaseClient });
})();
