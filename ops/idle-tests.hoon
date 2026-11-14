::  Independent policy clock; all HTTP and revocation cards stay in memory.
=/  own=ship  ~siglup-narwet
=/  who=ship  ~mapdex-fodtux-siglup-narwet
=/  b=bowl:gall  %*(. *bowl:gall our own, src own, dap %manor, now ~2026.11.14)
=/  key=@t  'idle-fixture-proof'
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
  |=  [tab=@ta modern=?]
  ^-  inbound-request:eyre
  =/  hdr=header-list:http
    ~[['x-forwarded-host' 'mapdex-fodtux-siglup-narwet.localhost:8091'] ['origin' 'http://mapdex-fodtux-siglup-narwet.localhost:8091'] ['cookie' (cat 3 'manor-visit=' key)]]
  [| | [%ipv4 .127.0.0.1] %'POST' '/~manor/visit/open' ?:(modern [['x-manor-client' '2'] hdr] hdr) `(as-octs:mimes:html (rap 3 ~[tab ':' stamp]))]
~|  %idle-is-optional-and-minutes-are-validated
?>  =(0 idle-minutes.pool)
?>  =(~ (mole |.((set-idle:~(. manor-pool [b pool]) 1))))
?>  =(~ (mole |.((set-idle:~(. manor-pool [b pool]) 1.441))))
=/  enabled  +:(set-idle:~(. manor-pool [b pool]) 15)
~|  %old-clients-cannot-be-idle-evicted-without-a-warning
=/  legacy  +:(visitor-tab:~(. manor-pool [b enabled]) who %open 'old-open' (request first |) target)
?>  =(~ idle-at:(~(got by visits.legacy) who))
=/  mixed  +:(visitor-tab:~(. manor-pool [b legacy]) who %open 'new-open' (request second &) target)
?>  =(~ idle-at:(~(got by visits.mixed) who))
=/  upgraded  +:(visitor-tab:~(. manor-pool [b mixed]) who %close 'old-close' (request first |) target)
?>  =(`(add now.b ~m15) idle-at:(~(got by visits.upgraded) who))
~|  %modern-visits-have-one-aggregate-server-deadline
=/  one  +:(visitor-tab:~(. manor-pool [b enabled]) who %open 'first-open' (request first &) target)
=/  two  +:(visitor-tab:~(. manor-pool [b one]) who %open 'second-open' (request second &) target)
=/  v  (~(got by visits.two) who)
?>  =(`(add now.b ~m15) idle-at.v)
~|  %reads-and-reconnects-never-count-as-human-activity
=/  read-req  (request first &)
=.  read-req  read-req(request [%'GET' '/~manor/visit/events' header-list.request.read-req ~])
=/  streamed  +:(visitor-read:~(. manor-pool [b two]) who & 'stream-one' read-req target `first `stamp)
=/  v-stream  (~(got by visits.streamed) who)
?>  =(idle-at.v idle-at.v-stream)
=/  state-read  +:(visitor-read:~(. manor-pool [b streamed]) who | 'state-read' read-req target `first `stamp)
?>  =(streamed state-read)
~|  %stream-and-state-require-this-visit-tab-and-same-origin
=/  foreign  read-req(header-list.request [['sec-fetch-site' 'cross-site'] header-list.request.read-req])
?>  =(streamed +:(visitor-read:~(. manor-pool [b streamed]) who & 'foreign-stream' foreign target `first `stamp))
?>  =(streamed +:(visitor-read:~(. manor-pool [b streamed]) who & 'wrong-proof' read-req target `first `'different-visit'))
?>  =(streamed +:(visitor-read:~(. manor-pool [b streamed]) who & 'unknown-tab' read-req target `'unknown-tab' `stamp))
=/  replaced  +:(visitor-read:~(. manor-pool [b(now (add now.b ~m2)) streamed]) who & 'stream-two' read-req target `first `stamp)
?>  =(1 ~(wyt by streams:(~(got by visits.replaced) who)))
?>  =(idle-at.v idle-at:(~(got by visits.replaced) who))
=/  unwatched  (visitor-unwatch:~(. manor-pool [b replaced]) 'stream-two')
?>  =(idle-at.v idle-at:(~(got by visits.unwatched) who))
?>  =(tabs.v tabs:(~(got by visits.unwatched) who))
~|  %activity-in-either-app-tab-extends-the-whole-visit
=/  active  +:(visitor-tab:~(. manor-pool [b(now (add now.b ~m5)) streamed]) who %activity 'activity' (request second &) target)
=/  fresh  (~(got by visits.active) who)
?>  =(`(add now.b ~m20) idle-at.fresh)
?>  =(active +:(idle-expire:~(. manor-pool [b(now (add now.b ~m16)) active]) who proof.v idle-revision.v))
~|  %disabling-idle-cancels-the-timer-without-freeing-the-claim
=/  disabled  +:(set-idle:~(. manor-pool [b active]) 0)
?>  =(~ idle-at:(~(got by visits.disabled) who))
?>  (~(has by claims.disabled) who)
?>  =(disabled +:(idle-expire:~(. manor-pool [b(now (add now.b ~h1)) disabled]) who proof.fresh idle-revision.fresh))
~|  %expiration-is-authoritative-but-still-requires-confirmed-revocation
=/  expired  (idle-expire:~(. manor-pool [b(now (add now.b ~m21)) active]) who proof.fresh idle-revision.fresh)
=/  revoking  +.expired
?>  =(~ visits.revoking)
?>  (~(has by claims.revoking) who)
?>  =(`'manor-1' pending:(~(got by ships.revoking) who))
?>  (gth (lent -.expired) 3)
=/  failed  +:(timeout:~(. manor-pool [b(now (add now.b ~m22)) revoking]) 'manor-1')
?>  (~(has by claims.failed) who)
?>  blocked:(~(got by ships.failed) who)
=/  done  +:(receive:~(. manor-pool [b revoking]) /full-result/manor-1 [%fact [%noun !>(`reply:manor-ship`['manor-1' %revoked 2])]])
?<  (~(has by claims.done) who)
~|  %expired-input-cannot-resurrect-an-ended-visit
=/  late  +:(visitor-tab:~(. manor-pool [b(now (add now.b ~m21)) active]) who %activity 'late-input' (request first &) target)
?>  =(~ visits.late)
=/  late-row  (~(got by ships.late) who)
?>  ?=(^ pending.late-row)
~|  %close-grace-still-works-with-idle-enabled
=/  first-closed  +:(visitor-tab:~(. manor-pool [b two]) who %close 'first-close' (request first &) target)
=/  last-closed  +:(visitor-tab:~(. manor-pool [b first-closed]) who %close 'last-close' (request second &) target)
=/  last-visit  (~(got by visits.last-closed) who)
?>  =(~ idle-at.last-visit)
?>  =(`(add now.b ~s30) deadline.last-visit)
0
