::  Synthetic liveness and recovery events; no cards are delivered.
=/  own=ship  ~siglup-narwet
=/  who=ship  ~mapdex-fodtux-siglup-narwet
=/  b=bowl:gall  %*(. *bowl:gall our own, src own, dap %manor, now ~2026.11.16)
=/  key=@t  'liveness-fixture'
=/  stamp  (scot %uv (sham key))
=/  first=@ta  ~.0123456789abcdef0123456789abcdef
=/  second=@ta  ~.abcdef0123456789abcdef0123456789
=/  st=status:manor-ship  [who `own 8.086 %glurff (silt `(list desk)`~[%glurff]) & | 0 ~]
=/  row=managed-ship:manor  [8.086 & `st ~ | ~ %manor ~]
=/  c=claim:manor  [now.b ~ ~ `now.b]
=/  v=visitor:manor  [now.b (sham key) ~ ~ ~ 0 ~ ~ 0 ~]
=/  initial  *managed-pool:manor
=/  pool  initial(ships (~(put by ships.initial) who row), claims (~(put by claims.initial) who c), visits (~(put by visits.initial) who v))
=/  target  ['http' 'localhost:8091']
=/  request
  |=  [tab=@ta pulse=?]
  ^-  inbound-request:eyre
  =/  hdr=header-list:http
    ~[['x-forwarded-host' 'mapdex-fodtux-siglup-narwet.localhost:8091'] ['origin' 'http://mapdex-fodtux-siglup-narwet.localhost:8091'] ['cookie' (cat 3 'manor-visit=' key)] ['x-manor-client' '2'] ['x-manor-liveness' '1']]
  =?  hdr  pulse  [['x-manor-heartbeat' '1'] hdr]
  [| | [%ipv4 .127.0.0.1] %'POST' '/~manor/visit/open' hdr `(as-octs:mimes:html (rap 3 ~[tab ':' stamp]))]
~|  %login-without-a-page-registration-gets-bounded-grace
=/  awaiting  +:(await-first-tab:~(. manor-pool [b pool]) who)
=/  entry  (~(got by visits.awaiting) who)
?>  =(`(add now.b ~m4) deadline.entry)
?>  =(~ idle-at.entry)
?>  =(~ pending:(~(got by ships.awaiting) who))
?>  =(awaiting +:(close-visit:~(. manor-pool [b(now (add now.b ~m3)) awaiting]) who proof.entry revision.entry))
~|  %first-page-registration-cancels-entry-timeout
=/  arrived  +:(visitor-tab:~(. manor-pool [b awaiting]) who %open 'first-page' (request first |) target)
?>  =(~ deadline:(~(got by visits.arrived) who))
?>  =(arrived +:(close-visit:~(. manor-pool [b(now (add now.b ~m5)) arrived]) who proof.entry revision.entry))
~|  %abandoned-login-is-never-freed-before-confirmed-logout
=/  abandoned  +:(close-visit:~(. manor-pool [b(now (add now.b ~m5)) awaiting]) who proof.entry revision.entry)
?>  (~(has by claims.abandoned) who)
?>  =(~ visits.abandoned)
?>  =(`'manor-1' pending:(~(got by ships.abandoned) who))
=/  freed  +:(receive:~(. manor-pool [b abandoned]) /full-result/manor-1 [%fact [%noun !>(`reply:manor-ship`['manor-1' %revoked 2])]])
?>  =(~ claims.freed)
~|  %a-late-first-page-cannot-bypass-a-due-entry-timer
=/  late-entry  +:(visitor-tab:~(. manor-pool [b(now (add now.b ~m5)) awaiting]) who %open 'late-first-page' (request first |) target)
?>  =(~ visits.late-entry)
?>  =(`'manor-1' pending:(~(got by ships.late-entry) who))
~|  %an-early-close-shortens-entry-grace-to-normal-close-grace
=/  closed-entry  +:(visitor-tab:~(. manor-pool [b awaiting]) who %close 'early-close' (request first |) target)
?>  =(`(add now.b ~s30) deadline:(~(got by visits.closed-entry) who))
~|  %reload-covers-existing-unregistered-visits-without-touching-active-ones
=/  recovered  +:resume-visits:~(. manor-pool [b(now (add now.b ~h1)) pool])
?>  =(`(add (add now.b ~h1) ~m4) deadline:(~(got by visits.recovered) who))
?>  =(recovered +:resume-visits:~(. manor-pool [b(now (add now.b ~h2)) recovered]))
=/  tracked  arrived(pulses ~)
?>  =(tracked +:resume-visits:~(. manor-pool [b(now (add now.b ~h1)) tracked]))
~|  %stale-entry-timers-cannot-release-a-new-claim
=/  replaced  awaiting(claims (~(put by claims.awaiting) who c(at (add at.c ~m1))))
=/  ignored  +:(close-visit:~(. manor-pool [b(now (add now.b ~m5)) replaced]) who proof.entry revision.entry)
?>  =((add at.c ~m1) at:(~(got by claims.ignored) who))
?>  =(~ pending:(~(got by ships.ignored) who))
~|  %heartbeats-renew-connections-but-never-human-activity
=/  enabled  +:(set-idle:~(. manor-pool [b pool]) 2)
=/  opened  +:(visitor-tab:~(. manor-pool [b enabled]) who %open 'open' (request first |) target)
=/  before  (~(got by visits.opened) who)
=/  pulsed  +:(visitor-tab:~(. manor-pool [b(now (add now.b ~m1)) opened]) who %open 'heartbeat' (request first &) target)
=/  after  (~(got by visits.pulsed) who)
?>  =(idle-at.before idle-at.after)
?>  =(idle-revision.before idle-revision.after)
?>  =((add now.b ~m5) (~(got by tabs:(~(got by pulses.pulsed) who)) first))
=/  idle-expired  +:(idle-expire:~(. manor-pool [b(now (add now.b ~m3)) pulsed]) who proof.after idle-revision.after)
?>  (~(has by claims.idle-expired) who)
=/  idle-row  (~(got by ships.idle-expired) who)
?>  ?=(^ pending.idle-row)
~|  %missed-close-notification-expires-only-after-reconnect-grace
=/  opened  +:(visitor-tab:~(. manor-pool [b pool]) who %open 'open' (request first |) target)
=/  pulse  (~(got by pulses.opened) who)
?>  =(opened +:(expire-pulses:~(. manor-pool [b(now (add now.b ~m3)) opened]) who (sham key) revision.pulse))
=/  expired  +:(expire-pulses:~(. manor-pool [b(now (add now.b ~m5)) opened]) who (sham key) revision.pulse)
=/  closing  (~(got by visits.expired) who)
?>  =(~ tabs.closing)
?>  =(~ pulses.expired)
?>  =(`(add (add now.b ~m5) ~s30) deadline.closing)
?>  (~(has by claims.expired) who)
~|  %a-second-live-tab-prevents-automatic-release
=/  two  +:(visitor-tab:~(. manor-pool [b(now (add now.b ~m2)) opened]) who %open 'second' (request second |) target)
=/  pulse  (~(got by pulses.two) who)
=/  one-left  +:(expire-pulses:~(. manor-pool [b(now (add now.b ~m5)) two]) who (sham key) revision.pulse)
=/  remaining  (~(got by visits.one-left) who)
?>  =(1 ~(wyt in tabs.remaining))
?>  (~(has in tabs.remaining) second)
?>  =(~ deadline.remaining)
~|  %closed-tabs-cannot-be-resurrected-by-a-late-heartbeat
?>  =(expired +:(visitor-tab:~(. manor-pool [b expired]) who %open 'late-heartbeat' (request first &) target))
~|  %old-pulse-timers-cannot-touch-a-new-visit
=/  newer  opened(visits (~(put by visits.opened) who v(proof (sham 'different-visit'))))
?>  =(newer +:(expire-pulses:~(. manor-pool [b(now (add now.b ~m5)) newer]) who (sham key) revision.pulse))
~|  %offline-cleanup-is-queued-and-retried-on-return
=/  offline  expired(ships (~(put by ships.expired) who row(online |)))
=/  queued  +:(close-visit:~(. manor-pool [b(now (add now.b ~m6)) offline]) who proof.closing revision.closing)
?>  (~(has by releases.queued) who)
?>  (~(has by claims.queued) who)
?>  =(~ pending:(~(got by ships.queued) who))
~|  %controller-reload-keeps-and-rearms-queued-cleanup
=/  resumed  +:resume:~(. manor-pool [b(now (add now.b ~m8)) queued])
?>  (~(has by releases.resumed) who)
?>  =(at.c claim-at:(~(got by releases.resumed) who))
?>  =((add now.b ~m9) deadline:(~(got by releases.resumed) who))
?>  (~(has by claims.resumed) who)
~|  %a-stale-release-cannot-unlock-a-replacement-visitor
=/  replacement  queued(claims (~(put by claims.queued) who c(at (add at.c ~m1))))
=/  retired  +:(retry-release:~(. manor-pool [b(now (add now.b ~m8)) replacement]) who at.c)
?>  =(~ releases.retired)
?>  =(~ pending:(~(got by ships.retired) who))
?>  =((add at.c ~m1) at:(~(got by claims.retired) who))
~|  %forgetting-a-ship-also-cancels-queued-cleanup
=/  forgotten  +:(forget:~(. manor-pool [b queued]) who)
?>  =(~ releases.forgotten)
?>  =(~ claims.forgotten)
?>  =(~ ships.forgotten)
~|  %fresh-status-retries-queued-cleanup
=/  returned  +:(receive:~(. manor-pool [b(now (add now.b ~m6)) queued]) /full-status/(scot %p who)/manor [%fact [%noun !>(st)]])
?>  =(`'manor-1' pending:(~(got by ships.returned) who))
?>  (~(has by claims.returned) who)
~|  %timed-out-cleanup-is-retried-without-prematurely-freeing-the-ship
=/  timed-out  +:(timeout:~(. manor-pool [b(now (add now.b ~m7)) returned]) 'manor-1')
=/  retried  +:(retry-release:~(. manor-pool [b(now (add now.b ~m7)) timed-out]) who at.c)
?>  =(`'manor-2' pending:(~(got by ships.retried) who))
?>  (~(has by claims.retried) who)
=/  confirmed  +:(receive:~(. manor-pool [b retried]) /full-result/manor-2 [%fact [%noun !>(`reply:manor-ship`['manor-2' %revoked 2])]])
?>  =(~ claims.confirmed)
?>  =(~ releases.confirmed)
~|  %a-profile-save-does-not-prevent-visitor-cleanup
=/  editing  +:(profile:~(. manor-pool [b expired]) who ``'Pilot' ~)
=/  cleanup  +:(close-visit:~(. manor-pool [b(now (add now.b ~m6)) editing]) who proof.closing revision.closing)
?>  (~(has by requests.cleanup) 'manor-1')
?>  =(`'manor-2' pending:(~(got by ships.cleanup) who))
~|  %one-offline-ship-cannot-alter-another-ships-reservation
=/  peer=ship  ~nolset
=/  separate  offline(ships (~(put by ships.offline) peer row), claims (~(put by claims.offline) peer c))
=/  queued  +:(close-visit:~(. manor-pool [b(now (add now.b ~m6)) separate]) who proof.closing revision.closing)
?>  =(c (~(got by claims.queued) peer))
?>  =(row (~(got by ships.queued) peer))
0
