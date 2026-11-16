::  Managed-ship pool. The public Theseus pool does not pass here.
/-  manor, manor-ship
/+  server
|_  [=bowl:gall full=managed-pool:manor]
+$  card  card:agent:gall
::
++  watch-moon
  |=  who=ship
  ^-  card:agent:gall
  =/  row  (~(got by ships.full) who)
  [%pass /full-status/(scot %p who)/[transport.row] %agent [who transport.row] %watch /status]
::
::  Gall keeps subscriptions across agent reloads and rejects duplicate wires.
++  refresh-watch
  |=  who=ship
  ^-  (list card)
  =/  row  (~(got by ships.full) who)
  =/  wire  /full-status/(scot %p who)/[transport.row]
  =/  cards=(list card)  ~
  =?  cards  (~(has by wex.bowl) [wire who transport.row])
    ~[[%pass wire %agent [who transport.row] %leave ~]]
  (snoc cards (watch-moon who))
::
++  apps-watch
  |=  [who=ship refresh=?]
  ^-  (list card)
  =/  row  (~(got by ships.full) who)
  ?.  =(%manor transport.row)  ~
  =/  wire  /ship-apps/(scot %p who)
  =/  exists  (~(has by wex.bowl) [wire who %manor])
  ?:  &(exists !refresh)  ~
  =/  cards=(list card)  ?:(exists ~[[%pass wire %agent [who %manor] %leave ~]] ~)
  (snoc cards [%pass wire %agent [who %manor] %watch /apps])
::
++  register
  |=  [who=ship endpoint=(unit endpoint:manor)]
  ^-  (quip card managed-pool:manor)
  ?>  (lte (met 0 who) 128)
  ?>  !=(who our.bowl)
  ?>  !(profile-busy who)
  ?>  ?~(endpoint & (valid-endpoint u.endpoint))
  =/  prior  (~(get by ships.full) who)
  =/  row=managed-ship:manor
    ?~  prior  [0 | ~ ~ & ~ %manor endpoint]
    ?>  =(~ pending.u.prior)
    ?>  !(~(has by claims.full) who)
    u.prior(online |, transport %manor, endpoint endpoint)
  =/  cards=(list card)
    ?~  prior  ~
    ~[[%pass /full-status/(scot %p who)/[transport.u.prior] %agent [who transport.u.prior] %leave ~]]
  =.  full  full(ships (~(put by ships.full) who row), apps (~(del by apps.full) who))
  [(weld (snoc cards (watch-moon who)) (apps-watch who &)) full]
::
++  reconnect
  |=  who=ship
  ^-  (quip card managed-pool:manor)
  =/  row  (~(got by ships.full) who)
  ?>  =(~ pending.row)
  =.  full  full(ships (~(put by ships.full) who row(online |)))
  [(weld (refresh-watch who) (apps-watch who &)) full]
::
++  valid-endpoint
  |=  e=endpoint:manor
  ^-  ?
  =/  host  (trip host.e)
  ?&  (gth (lent host) 0)
      (lte (lent host) 253)
      (gte port.e 1)
      (lte port.e 65.535)
      |(secure.e =(host.e '127.0.0.1') =(host.e 'localhost'))
      (levy host |=(c=@t |(&((gte c 'a') (lte c 'z')) &((gte c '0') (lte c '9')) =(c '-') =(c '.'))))
  ==
::
++  destination
  |=  row=managed-ship:manor
  ^-  (unit endpoint:manor)
  ?^  endpoint.row
    =/  ep  u.endpoint.row
    `ep(host ?:(=('localhost' host.ep) '127.0.0.1' host.ep))
  ?:  =(0 port.row)  ~
  `['127.0.0.1' port.row |]
::
++  same-target
  |=  [left=endpoint:manor right=(unit endpoint:manor)]
  ^-  ?
  ?~  right  |
  &(=(host.left host.u.right) =(port.left port.u.right))
::
++  safe-target
  |=  [dst=endpoint:manor own-port=@ud]
  ^-  ?
  ?.  |(=(host.dst '127.0.0.1') =(host.dst 'localhost'))  &
  !=(port.dst own-port)
::
++  configure
  |=  [who=ship landing=desk required=(set desk)]
  ^-  (quip card managed-pool:manor)
  =/  row  (~(got by ships.full) who)
  ?>  =(~ pending.row)
  ?>  !(~(has by claims.full) who)
  :_  full
  ~[(command who /ship-configure/(scot %p who) [%configure landing required])]
::
++  profile
  |=  [who=ship name=(unit (unit @t)) avatar=(unit (unit @t))]
  ^-  (quip card managed-pool:manor)
  ?>  (valid-profile:manor-ship name avatar)
  (begin who [%profile name avatar] ~ *@da)
::
++  profile-busy
  |=  who=ship
  ^-  ?
  (lien ~(val by requests.full) |=(r=managed-request:manor &(=(who who.r) =(%profile op.r))))
::
++  remove
  |=  who=ship
  ^-  (quip card managed-pool:manor)
  =/  row  (~(got by ships.full) who)
  ?>  =(~ pending.row)
  ?>  !(profile-busy who)
  ?>  !(~(has by claims.full) who)
  =^  stopped  full  (drop-visit who)
  =^  cancelled  full  (clear-release who)
  :_  full(ships (~(del by ships.full) who), apps (~(del by apps.full) who))
  (weld cancelled (weld stopped (weld ~[[%pass /full-status/(scot %p who)/[transport.row] %agent [who transport.row] %leave ~]] (leave-apps who))))
::
++  leave-apps
  |=  who=ship
  ^-  (list card)
  ?.  (~(has by wex.bowl) [/ship-apps/(scot %p who) who %manor])  ~
  ~[[%pass /ship-apps/(scot %p who) %agent [who %manor] %leave ~]]
::
::  Owner override for a retired ship. Drop local reservations, not sessions.
++  forget
  |=  who=ship
  ^-  (quip card managed-pool:manor)
  =/  prior  (~(get by ships.full) who)
  ?~  prior  `full
  =/  row  u.prior
  =^  stopped  full  (drop-visit who)
  =^  cancelled  full  (clear-release who)
  =/  out  full
  =/  cards=(list card)
    (weld cancelled (weld stopped (weld ~[[%pass /full-status/(scot %p who)/[transport.row] %agent [who transport.row] %leave ~]] (leave-apps who))))
  =/  legacy-wire  /full-status/(scot %p who)
  =?  cards  (~(has by wex.bowl) [legacy-wire who %manor-moon])
    (snoc cards [%pass legacy-wire %agent [who %manor-moon] %leave ~])
  =/  todo  ~(tap by requests.full)
  |-  ^-  (quip card managed-pool:manor)
  ?~  todo
    [cards out(ships (~(del by ships.out) who), claims (~(del by claims.out) who), apps (~(del by apps.out) who))]
  =/  [rid=@ta req=managed-request:manor]  i.todo
  ?.  =(who who.req)  $(todo t.todo)
  =/  replies=(list card)
    ?~  eyre.req  ~
    (answer u.eyre.req 503 'This ship was removed from Manor.')
  $(todo t.todo, out out(requests (~(del by requests.out) rid)), cards (weld cards (weld (cleanup rid req) replies)))
::
++  unlock
  |=  who=ship
  ^-  (quip card managed-pool:manor)
  =/  row  (~(got by ships.full) who)
  ?>  online.row
  ?>  =(~ pending.row)
  =^  stopped  full  (drop-visit who)
  =/  work  (begin who %revoke ~ *@da)
  [(weld stopped -.work) +.work]
::
++  visit-wire
  |=  [who=ship v=visitor:manor]
  ^-  wire
  /visit-close/(scot %p who)/(scot %uv proof.v)/(scot %ud revision.v)
::
++  drop-visit
  |=  who=ship
  ^-  (quip card managed-pool:manor)
  =/  v  (~(get by visits.full) who)
  ?~  v  `full
  =/  cards  (visitor-event u.v %ending ~)
  =.  cards
    (weld cards (turn ~(tap by streams.u.v) |=([id=@ta tab=@ta] `card`[%give %kick ~[/http-response/[id]] ~])))
  =?  cards  ?=(^ deadline.u.v)
    (snoc cards [%pass (visit-wire who u.v) %arvo %b %rest (need deadline.u.v)])
  =?  cards  ?=(^ idle-at.u.v)
    (snoc cards [%pass (idle-wire who u.v) %arvo %b %rest (need idle-at.u.v)])
  =/  pulse  (~(get by pulses.full) who)
  =?  cards  ?=(^ pulse)
    (snoc cards [%pass (pulse-wire who u.v u.pulse) %arvo %b %rest deadline.u.pulse])
  [cards full(visits (~(del by visits.full) who), pulses (~(del by pulses.full) who))]
::
++  idle-wire
  |=  [who=ship v=visitor:manor]
  ^-  wire
  /visit-idle/(scot %p who)/(scot %uv proof.v)/(scot %ud idle-revision.v)
::
++  visitor-policy
  |=  v=visitor:manor
  ^-  json
  %-  pairs:enjs:format
  :~  ['enabled' b+?=(^ idle-at.v)]
      ['minutes' (numb:enjs:format idle-minutes.full)]
      ['warningSeconds' (numb:enjs:format 60)]
      ['revision' (numb:enjs:format idle-revision.v)]
      ['expiresAt' ?~(idle-at.v ~ (ms u.idle-at.v))]
      ['now' (ms now.bowl)]
  ==
::
++  visitor-event
  |=  [v=visitor:manor name=@tas data=json]
  ^-  (list card)
  =/  body  (as-octs:mimes:html (rap 3 ~['event: ' name '\0adata: ' (en:json:html data) '\0a\0a']))
  %+  turn  ~(tap by streams.v)
  |=  [id=@ta tab=@ta]
  [%give %fact ~[/http-response/[id]] %http-response-data !>(`(unit octs)`[~ body])]
::
++  visitor-answer
  |=  [id=@ta who=ship modern=?]
  ^-  (list card)
  ?.  modern  (answer id 204 '')
  =/  data  (en:json:html (visitor-policy (~(got by visits.full) who)))
  %+  give-simple-payload:app:server  id
  [[200 ['content-type' 'application/json'] ['cache-control' 'no-store'] ~] `(as-octs:mimes:html data)]
::
++  retire-streams
  |=  [v=visitor:manor tab=@ta]
  ^-  (quip card visitor:manor)
  =/  todo  ~(tap by streams.v)
  =/  cards=(list card)  ~
  |-  ^-  (quip card visitor:manor)
  ?~  todo  [cards v]
  ?.  =(tab q.i.todo)  $(todo t.todo)
  =/  id  p.i.todo
  $(todo t.todo, v v(streams (~(del by streams.v) id)), cards (snoc cards [%give %kick ~[/http-response/[id]] ~]))
::
++  visitor-unwatch
  |=  id=@ta
  ^-  managed-pool:manor
  %=  full
    visits  (~(run by visits.full) |=(v=visitor:manor v(streams (~(del by streams.v) id))))
  ==
::
++  pulse-wire
  |=  [who=ship v=visitor:manor p=pulse:manor]
  ^-  wire
  /visit-pulse/(scot %p who)/(scot %uv proof.v)/(scot %ud revision.p)
::
++  set-pulses
  |=  [who=ship tabs=(map @ta @da)]
  ^-  (quip card managed-pool:manor)
  =/  v  (~(got by visits.full) who)
  =/  old  (~(get by pulses.full) who)
  =/  cards=(list card)  ~
  ?:  =(~ tabs)
    =?  cards  ?=(^ old)
      ~[[%pass (pulse-wire who v u.old) %arvo %b %rest deadline.u.old]]
    [cards full(pulses (~(del by pulses.full) who))]
  =/  next=@da  (head (sort ~(val by tabs) |=([a=@da b=@da] (lth a b))))
  =/  changed  ?~(old & !=(next deadline.u.old))
  =/  revision=@ud  ?~(old 1 (add revision.u.old ?:(changed 1 0)))
  =/  pulse=pulse:manor  [tabs next revision]
  =?  cards  &(changed ?=(^ old))
    ~[[%pass (pulse-wire who v u.old) %arvo %b %rest deadline.u.old]]
  =?  cards  changed
    (snoc cards [%pass (pulse-wire who v pulse) %arvo %b %wait next])
  [cards full(pulses (~(put by pulses.full) who pulse))]
::
++  renew-pulse
  |=  [who=ship tab=@ta]
  ^-  (quip card managed-pool:manor)
  =/  old  (~(get by pulses.full) who)
  =/  tabs=(map @ta @da)  ?~(old ~ tabs.u.old)
  ::  Four minutes allows missed one-minute heartbeats and reconnection.
  (set-pulses who (~(put by tabs) tab (add now.bowl ~m4)))
::
++  await-first-tab
  |=  who=ship
  ^-  (quip card managed-pool:manor)
  =/  v  (~(get by visits.full) who)
  =/  c  (~(get by claims.full) who)
  ?~  v  `full
  ?~  c  `full
  ?.  &(=(claim-at.u.v at.u.c) ?=(^ entered.u.c))  `full
  ?:  |(!=(~ tabs.u.v) !=(~ seen.u.v) ?=(^ deadline.u.v))  `full
  ::  Login may finish even if the browser never reaches the visitor page.
  =/  next=visitor:manor
    [claim-at.u.v proof.u.v tabs.u.v seen.u.v `(add now.bowl ~m4) +(revision.u.v) idle-tabs.u.v idle-at.u.v idle-revision.u.v streams.u.v]
  :_  full(visits (~(put by visits.full) who next))
  ~[[%pass (visit-wire who next) %arvo %b %wait (need deadline.next)]]
::
++  maybe-close
  |=  who=ship
  ^-  (quip card managed-pool:manor)
  =/  v  (~(got by visits.full) who)
  ?:  !=(~ tabs.v)  `full
  =/  until  (add now.bowl ~s30)
  ?:  ?~(deadline.v | (lte u.deadline.v until))  `full
  =/  cards=(list card)
    ?~  deadline.v  ~
    ~[[%pass (visit-wire who v) %arvo %b %rest u.deadline.v]]
  =/  next=visitor:manor
    [claim-at.v proof.v tabs.v seen.v `until +(revision.v) idle-tabs.v idle-at.v idle-revision.v streams.v]
  :_  full(visits (~(put by visits.full) who next))
  (snoc cards [%pass (visit-wire who next) %arvo %b %wait (need deadline.next)])
::
++  expire-pulses
  |=  [who=ship proof=@uvH revision=@ud]
  ^-  (quip card managed-pool:manor)
  =/  v  (~(get by visits.full) who)
  =/  pulse  (~(get by pulses.full) who)
  ?~  v  `full
  ?~  pulse  `full
  ?.  &(=(proof proof.u.v) =(revision revision.u.pulse) (gte now.bowl deadline.u.pulse))  `full
  =/  todo=(list @ta)
    (turn (skim ~(tap by tabs.u.pulse) |=([tab=@ta until=@da] (lte until now.bowl))) head)
  =/  alive=(map @ta @da)
    (malt (skim ~(tap by tabs.u.pulse) |=([tab=@ta until=@da] (gth until now.bowl))))
  =/  current=visitor:manor  u.v
  =/  cards=(list card)  ~
  |-
  ?^  todo
    =^  stopped  current  (retire-streams current i.todo)
    $(todo t.todo, current current(tabs (~(del in tabs.current) i.todo), idle-tabs (~(del in idle-tabs.current) i.todo)), cards (weld cards stopped))
  =.  full  full(visits (~(put by visits.full) who current))
  =^  more  full  (set-pulses who alive)
  =.  cards  (weld cards more)
  =^  more  full  (idle-refresh who |)
  =.  cards  (weld cards more)
  =^  more  full  (maybe-close who)
  [(weld cards more) full]
::
++  idle-refresh
  |=  [who=ship reset=?]
  ^-  (quip card managed-pool:manor)
  =/  v  (~(got by visits.full) who)
  =/  eligible=?  &((gth idle-minutes.full 0) !=(~ tabs.v) =(tabs.v idle-tabs.v))
  =/  next=(unit @da)
    ?.  eligible  ~
    ?:  &(?=(^ idle-at.v) !reset)  idle-at.v
    `(add now.bowl (mul idle-minutes.full ~m1))
  =/  cards=(list card)  ~
  =/  changed  |(reset !=(next idle-at.v))
  =?  cards  &(changed ?=(^ idle-at.v))
    ~[[%pass (idle-wire who v) %arvo %b %rest (need idle-at.v)]]
  =.  v  v(idle-at next, idle-revision (add idle-revision.v ?:(changed 1 0)))
  =?  cards  &(changed ?=(^ next))
    (snoc cards [%pass (idle-wire who v) %arvo %b %wait (need next)])
  [(weld cards (visitor-event v %policy (visitor-policy v))) full(visits (~(put by visits.full) who v))]
::
++  set-idle
  |=  minutes=@ud
  ^-  (quip card managed-pool:manor)
  ?>  |(=(0 minutes) &((gte minutes 2) (lte minutes 1.440)))
  =.  full  full(idle-minutes minutes)
  =/  todo  ~(tap by visits.full)
  =/  cards=(list card)  ~
  |-  ^-  (quip card managed-pool:manor)
  ?~  todo  [cards full]
  =^  more  full  (idle-refresh p.i.todo &)
  $(todo t.todo, cards (weld cards more))
::
++  idle-expire
  |=  [who=ship proof=@uvH revision=@ud]
  ^-  (quip card managed-pool:manor)
  =/  v  (~(get by visits.full) who)
  ?~  v  `full
  ?.  &(=(proof proof.u.v) =(revision idle-revision.u.v) !=(~ tabs.u.v))  `full
  ?~  idle-at.u.v  `full
  ?:  (lth now.bowl u.idle-at.u.v)  `full
  (revoke-visitor who)
::
++  visitor-read
  |=  [who=ship events=? id=@ta req=inbound-request:eyre target=[scheme=@t suffix=@t] tab=(unit @t) stamp=(unit @t)]
  ^-  (quip card managed-pool:manor)
  ?.  &((visitor-valid who req target |) =(%'GET' method.request.req))
    [(answer id 403 'This visit has ended.') full]
  =/  site  (get-header:http 'sec-fetch-site' header-list.request.req)
  ?:  ?~(site | !=('same-origin' u.site))
    [(answer id 403 'Use the assigned ship address.') full]
  ?~  tab  [(answer id 400 'Missing tab identity.') full]
  ?~  stamp  [(answer id 400 'Missing visit identity.') full]
  =/  v  (~(got by visits.full) who)
  ?.  &((~(has in idle-tabs.v) `@ta`u.tab) =(u.stamp (scot %uv proof.v)))
    [(answer id 403 'This tab is no longer available.') full]
  ?:  ?~(idle-at.v | (gte now.bowl u.idle-at.v))
    =/  work  (idle-expire who proof.v idle-revision.v)
    [(weld -.work (answer id 403 'This visit has ended.')) +.work]
  ?.  events  [(visitor-answer id who &) full]
  =^  cards  v  (retire-streams v `@ta`u.tab)
  =.  v  v(streams (~(put by streams.v) id `@ta`u.tab))
  :_  full(visits (~(put by visits.full) who v))
  =/  header=card
    [%give %fact ~[/http-response/[id]] %http-response-header !>(`response-header:http`[200 ['content-type' 'text/event-stream'] ['cache-control' 'no-store'] ['x-accel-buffering' 'no'] ~])]
  (weld (snoc cards header) (visitor-event v %policy (visitor-policy v)))
::
++  visitor-valid
  |=  [who=ship req=inbound-request:eyre target=[scheme=@t suffix=@t] post=?]
  ^-  ?
  ?.  =([%ipv4 .127.0.0.1] address.req)  |
  =/  host=@t  (rap 3 ~[(rsh 3 (scot %p who)) '.' suffix.target])
  ?.  =(`host (get-header:http 'x-forwarded-host' header-list.request.req))  |
  ?:  &(post !=(`(rap 3 ~[scheme.target '://' host]) (get-header:http 'origin' header-list.request.req)))  |
  =/  v  (~(get by visits.full) who)
  =/  c  (~(get by claims.full) who)
  =/  row  (~(get by ships.full) who)
  ?~  v  |
  ?~  c  |
  ?~  row  |
  ?.  &(=(claim-at.u.v at.u.c) ?=(^ entered.u.c) !blocked.u.row)  |
  =/  revoking=?
    ?~  pending.u.row  |
    =/  work  (~(get by requests.full) u.pending.u.row)
    ?~  work  &
    =(%revoke op.u.work)
  ?:  revoking  |
  =/  header  (get-header:http 'cookie' header-list.request.req)
  ?~  header  |
  =/  cookies  (rush u.header cock:de-purl:html)
  ?~  cookies  |
  =/  key  (get-header:http 'manor-visit' u.cookies)
  ?~  key  |
  ?.  (lte (met 3 u.key) 100)  |
  =(proof.u.v (sham u.key))
::
++  visitor-tab
  |=  [who=ship op=?(%open %close %activity) eyre-id=@ta req=inbound-request:eyre target=[scheme=@t suffix=@t]]
  ^-  (quip card managed-pool:manor)
  ?.  (visitor-valid who req target &)
    [(answer eyre-id 403 'This visit is no longer available.') full]
  ?.  =(%'POST' method.request.req)  [(answer eyre-id 405 'Use POST.') full]
  ?~  body.request.req  [(answer eyre-id 400 'Missing tab identity.') full]
  =/  data  u.body.request.req
  ?.  &((gth p.data 33) (lte p.data 150) =(p.data (met 3 q.data)))
    [(answer eyre-id 400 'Invalid tab identity.') full]
  =/  v  (~(got by visits.full) who)
  ?.  =(':' (end 3 (rsh [3 32] q.data)))  [(answer eyre-id 400 'Invalid tab identity.') full]
  ?.  =((scot %uv proof.v) (rsh [3 33] q.data))
    [(answer eyre-id 409 'This tab belongs to an older visit.') full]
  =/  tab=@ta  `@ta`(end [3 32] q.data)
  ?.  %+  levy  (trip tab)
      |=(c=@t |(&((gte c '0') (lte c '9')) &((gte c 'a') (lte c 'f'))))
    [(answer eyre-id 400 'Invalid tab identity.') full]
  =/  known  (~(has in seen.v) tab)
  =/  modern  =(`'2' (get-header:http 'x-manor-client' header-list.request.req))
  =/  liveness  =(`'1' (get-header:http 'x-manor-liveness' header-list.request.req))
  =/  heartbeat  &(=(%open op) =(`'1' (get-header:http 'x-manor-heartbeat' header-list.request.req)))
  ?:  ?~(idle-at.v | (gte now.bowl u.idle-at.v))
    =/  work  (idle-expire who proof.v idle-revision.v)
    [(weld -.work (answer eyre-id 403 'This visit has ended.')) +.work]
  ?:  &(=(~ tabs.v) ?~(deadline.v | (gte now.bowl u.deadline.v)))
    =/  work  (close-visit who proof.v revision.v)
    [(weld -.work (answer eyre-id 403 'This visit has ended.')) +.work]
  ?:  heartbeat
    ?.  &(modern liveness known (~(has in tabs.v) tab))
      [(answer eyre-id 409 'This tab has closed.') full]
    =^  cards  full  (renew-pulse who tab)
    [(weld cards (answer eyre-id 204 '')) full]
  ?:  =(%activity op)
    ?.  &(modern (~(has in idle-tabs.v) tab) (~(has in tabs.v) tab))
      [(answer eyre-id 403 'This tab is not available.') full]
    =^  cards  full  (idle-refresh who &)
    [(weld cards (visitor-answer eyre-id who &)) full]
  ?:  =(%open op)
    ?:  &(known !(~(has in tabs.v) tab))
      [(answer eyre-id 409 'This tab has closed.') full]
    ?:  &(!known (gte ~(wyt in seen.v) 512))
      [(answer eyre-id 429 'This visit has opened too many tabs.') full]
    =/  alive=(list card)  ~
    =^  alive  full  ?.(liveness `full (renew-pulse who tab))
    ?:  known
      ?.  (~(has in tabs.v) tab)  [(answer eyre-id 409 'This tab has closed.') full]
      ?:  |(!modern (~(has in idle-tabs.v) tab))  [(weld alive (visitor-answer eyre-id who modern)) full]
      =.  full  full(visits (~(put by visits.full) who v(idle-tabs (~(put in idle-tabs.v) tab))))
      =^  cards  full  (idle-refresh who &)
      [(weld alive (weld cards (visitor-answer eyre-id who &))) full]
    =/  cards=(list card)
      ?~  deadline.v  ~
      ~[[%pass (visit-wire who v) %arvo %b %rest u.deadline.v]]
    =.  v  v(tabs (~(put in tabs.v) tab), seen (~(put in seen.v) tab), deadline ~, revision +(revision.v), idle-tabs ?:(modern (~(put in idle-tabs.v) tab) idle-tabs.v))
    =.  full  full(visits (~(put by visits.full) who v))
    =^  more  full  (idle-refresh who &)
    [(weld alive (weld cards (weld more (visitor-answer eyre-id who modern)))) full]
  ?:  &(known !(~(has in tabs.v) tab))  [(answer eyre-id 204 '') full]
  ::  A close may precede its keepalive open. Do not resurrect that tab.
  ?:  &(!known (gte ~(wyt in seen.v) 512))  [(answer eyre-id 204 '') full]
  =.  v  v(tabs (~(del in tabs.v) tab), seen (~(put in seen.v) tab), idle-tabs (~(del in idle-tabs.v) tab))
  =^  stopped  v  (retire-streams v tab)
  =.  full  full(visits (~(put by visits.full) who v))
  =/  pulse  (~(get by pulses.full) who)
  =/  alive=(list card)  ~
  =^  alive  full  ?~(pulse `full (set-pulses who (~(del by tabs.u.pulse) tab)))
  =^  changed  full  (idle-refresh who |)
  =/  cards=(list card)  (weld alive (weld stopped changed))
  =^  more  full  (maybe-close who)
  [(weld cards (weld more (answer eyre-id 204 ''))) full]
::
++  close-visit
  |=  [who=ship proof=@uvH revision=@ud]
  ^-  (quip card managed-pool:manor)
  =/  v  (~(get by visits.full) who)
  ?~  v  `full
  ?.  =(proof proof.u.v)  `full
  ?.  =(revision revision.u.v)  `full
  ?~  deadline.u.v  `full
  ?:  |((lth now.bowl u.deadline.u.v) !=(~ tabs.u.v))  `full
  (revoke-visitor who)
::
++  revoke-visitor
  |=  who=ship
  ^-  (quip card managed-pool:manor)
  =/  v  (~(get by visits.full) who)
  ?~  v  `full
  =/  c  (~(get by claims.full) who)
  =/  row  (~(get by ships.full) who)
  ?~  c  (drop-visit who)
  ?~  row  (drop-visit who)
  ?.  =(claim-at.u.v at.u.c)  (drop-visit who)
  =^  stopped  full  (drop-visit who)
  =.  full  full(ships (~(put by ships.full) who u.row(blocked &)))
  =^  more  full  (queue-release who at.u.c)
  =^  work  full  (try-release who)
  [(weld stopped (weld more work)) full]
::
++  release-wire
  |=  [who=ship at=@da]
  ^-  wire
  /release-retry/(scot %p who)/(scot %da at)
::
++  clear-release
  |=  who=ship
  ^-  (quip card managed-pool:manor)
  =/  old  (~(get by releases.full) who)
  ?~  old  `full
  :_  full(releases (~(del by releases.full) who))
  ~[[%pass (release-wire who claim-at.u.old) %arvo %b %rest deadline.u.old]]
::
++  queue-release
  |=  [who=ship at=@da]
  ^-  (quip card managed-pool:manor)
  =^  cards  full  (clear-release who)
  =/  deadline  (add now.bowl ~m1)
  :_  full(releases (~(put by releases.full) who [at deadline]))
  (snoc cards [%pass (release-wire who at) %arvo %b %wait deadline])
::
++  try-release
  |=  who=ship
  ^-  (quip card managed-pool:manor)
  =/  work  (~(get by releases.full) who)
  ?~  work  `full
  =/  c  (~(get by claims.full) who)
  =/  row  (~(get by ships.full) who)
  ?~  c  (clear-release who)
  ?~  row  (clear-release who)
  ?.  =(claim-at.u.work at.u.c)  (clear-release who)
  ?.  &(online.u.row =(~ pending.u.row))  `full
  ?~  status.u.row  `full
  ?:  busy.u.status.u.row  `full
  (unlock who)
::
++  retry-release
  |=  [who=ship at=@da]
  ^-  (quip card managed-pool:manor)
  =/  work  (~(get by releases.full) who)
  ?~  work  `full
  ?.  &(=(at claim-at.u.work) (gte now.bowl deadline.u.work))  `full
  =^  cards  full  (queue-release who at)
  =^  more  full  (try-release who)
  [(weld cards more) full]
::
::  Restarting the controller makes interrupted work indeterminate. Keep
::  its claims and quarantine the ship until a confirmed unlock.
++  resume
  ^-  (quip card managed-pool:manor)
  =/  out  full(requests ~)
  =|  cards=(list card:agent:gall)
  =/  todo  ~(tap by requests.full)
  =.  cards
    %-  zing
    %+  turn  todo
    |=  [rid=@ta req=managed-request:manor]
    (weld (cleanup rid req) ?~(eyre.req ~ (answer u.eyre.req 502 'The controller restarted. Unlock this ship before retrying.')))
  =/  rows  ~(tap by ships.full)
  |-  ^-  (quip card managed-pool:manor)
  ?~  rows
    =.  full  out
    =^  more  full  resume-visits
    [(weld cards more) full]
  =/  [who=ship row=managed-ship:manor]  i.rows
  ::  State %2 used an unversioned status wire. Retire that subscription
  ::  before replacing it, so migrations do not keep duplicate watches.
  =/  legacy-wire  /full-status/(scot %p who)
  =?  cards  (~(has by wex.bowl) [legacy-wire who %manor-moon])
    (snoc cards [%pass legacy-wire %agent [who %manor-moon] %leave ~])
  =?  row  ?=(^ pending.row)
    =/  req  (~(get by requests.full) u.pending.row)
    ?:  ?~(req | =(%profile op.u.req))
      =/  status  status.row
      =?  status  ?=(^ status)  `u.status(busy |)
      row(status status)
    row(blocked &, fault `'Controller restarted during a request.')
  =.  row  row(online |, pending ~)
  $(rows t.rows, cards (weld cards (weld (refresh-watch who) (apps-watch who &))), out out(ships (~(put by ships.out) who row)))
::
++  resume-visits
  ^-  (quip card managed-pool:manor)
  =/  waiting  ~(tap by visits.full)
  =/  cards=(list card)  ~
  |-
  ?^  waiting
    =^  more  full  (await-first-tab p.i.waiting)
    $(waiting t.waiting, cards (weld cards more))
  =/  todo  ~(tap by pulses.full)
  |-
  ?^  todo
    =/  who  p.i.todo
    =/  v  (~(get by visits.full) who)
    ?~  v
      $(todo t.todo, full full(pulses (~(del by pulses.full) who)))
    =/  grace  (add now.bowl ~s90)
    =/  tabs=(map @ta @da)
      (~(run by tabs.q.i.todo) |=(at=@da ?:((lth at grace) grace at)))
    =^  more  full  (set-pulses who tabs)
    $(todo t.todo, cards (weld cards more))
  =/  pending  ~(tap by releases.full)
  |-
  ?~  pending  [cards full]
  =^  more  full  (queue-release p.i.pending claim-at.q.i.pending)
  $(pending t.pending, cards (weld cards more))
::
++  begin
  |=  [who=ship request=$@(?(%session %revoke) [%profile name=(unit (unit @t)) avatar=(unit (unit @t))]) eyre=(unit @ta) claim-at=@da]
  ^-  (quip card managed-pool:manor)
  (begin-secure who request eyre claim-at |)
::
++  begin-secure
  |=  [who=ship request=$@(?(%session %revoke) [%profile name=(unit (unit @t)) avatar=(unit (unit @t))]) eyre=(unit @ta) claim-at=@da secure=?]
  ^-  (quip card managed-pool:manor)
  =/  row  (~(got by ships.full) who)
  =/  profiling=?  ?=(^ request)
  ?>  ?:(profiling !(profile-busy who) =(~ pending.row))
  =/  blocking=?  |(!profiling =(%manor-moon transport.row))
  ?>  ?:(blocking =(~ pending.row) &)
  =/  serial  +(serial.full)
  =/  rid=@ta  (crip "manor-{(a-co:co serial)}")
  =/  deadline  (add now.bowl ~s45)
  =/  op=?(%session %revoke %profile)  ?^(request %profile request)
  =/  req=managed-request:manor  [who op eyre claim-at deadline secure]
  =/  action=action:manor-ship
    ?^  request  [%profile rid name.request avatar.request]
    ?:  =(%session op)  [%session rid]
    [%revoke rid]
  :_  %=  full
        serial    serial
        ships     ?:(blocking (~(put by ships.full) who row(pending `rid, fault ~)) ships.full)
        requests  (~(put by requests.full) rid req)
      ==
  :~  [%pass /full-result/[rid] %agent [who transport.row] %watch /result/[rid]]
      (command who /full-ask/[rid] action)
      [%pass /full-timeout/[rid] %arvo %b %wait deadline]
  ==
::
++  command
  |=  [who=ship wire=wire action=action:manor-ship]
  ^-  card
  =/  row  (~(got by ships.full) who)
  :*  %pass  wire  %agent  [who transport.row]
      %poke  ?:(=(%manor transport.row) %manor-ship-action %manor-moon-action)  !>(action)
  ==
::
++  record-status
  |=  [who=ship status=status:manor-ship]
  ^-  managed-pool:manor
  =/  row  (~(got by ships.full) who)
  =/  own-port  .^([@ud (unit @ud)] %e /(scot %p our.bowl)/ports/(scot %da now.bowl))
  =/  dst  (destination row(port port.status))
  =/  port-ok=?
    ?~  dst  |
    ?&  (gte port.status 1)
        (lte port.status 65.535)
        |(?=(^ endpoint.row) =(0 port.row) =(port.row port.status))
        (safe-target u.dst -.own-port)
        %+  levy  ~(tap by ships.full)
        |=([s=ship m=managed-ship:manor] |(=(s who) !(same-target u.dst (destination m))))
    ==
  =/  ok  &(=(who who.status) =(`our.bowl controller.status) port-ok)
  full(ships (~(put by ships.full) who row(online ok, status `status, port ?:(ok port.status port.row))))
::
++  receive
  |=  [=wire =sign:agent:gall]
  ^-  (quip card managed-pool:manor)
  ?:  ?=([%ship-apps @ ~] wire)
    =/  who  (slav %p i.t.wire)
    =/  row  (~(get by ships.full) who)
    ?~  row  `full
    ?.  =(%manor transport.u.row)  `full
    ?:  ?=(%fact -.sign)
      =/  items  ;;((list installed-app:manor-ship) q.q.cage.sign)
      ?>  (lte (lent items) 256)
      `full(apps (~(put by apps.full) who items))
    ?:  |(?=(%kick -.sign) &(?=(%watch-ack -.sign) ?=(^ p.sign)))
      `full(apps (~(del by apps.full) who))
    `full
  ?:  ?=([%ship-configure @ ~] wire)
    =/  who  (slav %p i.t.wire)
    =/  row  (~(get by ships.full) who)
    ?~  row  `full
    ?:  &(?=(%poke-ack -.sign) ?=(^ p.sign))
      `full(ships (~(put by ships.full) who u.row(fault `'The ship refused the landing configuration.')))
    `full
  ?:  ?=([%full-status @ @ ~] wire)
    =/  who  (slav %p i.t.wire)
    =/  got  (~(get by ships.full) who)
    ?~  got  `full
    =/  row  u.got
    ?.  =(i.t.t.wire transport.row)  `full
    ?:  ?=(%fact -.sign)
      =/  status  ;;(status:manor-ship q.q.cage.sign)
      =.  full  (record-status who status)
      (try-release who)
    ?:  |(?=(%kick -.sign) &(?=(%watch-ack -.sign) ?=(^ p.sign)))
      `full(ships (~(put by ships.full) who row(online |)))
    `full
  ?.  ?=([?(%full-result %full-ask) @ ~] wire)  `full
  =/  rid=@ta  i.t.wire
  =/  req  (~(get by requests.full) rid)
  ?~  req  `full
  ?:  ?=([%full-ask *] wire)
    ?:  &(?=(%poke-ack -.sign) ?=(^ p.sign))  (failed rid 'The ship refused the request.')
    `full
  ?:  ?=(%fact -.sign)
    =/  reply  ;;(reply:manor-ship q.q.cage.sign)
    ?.  =(rid rid.reply)  (failed rid 'The ship returned a mismatched request.')
    (finished rid result.reply)
  ?:  |(?=(%kick -.sign) &(?=(%watch-ack -.sign) ?=(^ p.sign)))
    (failed rid 'The ship did not complete the request.')
  `full
::
++  timeout
  |=  rid=@ta
  ^-  (quip card managed-pool:manor)
  =/  req  (~(get by requests.full) rid)
  ?~  req  `full
  ?:  (lth now.bowl deadline.u.req)  `full
  (failed rid ?:(=(%profile op.u.req) 'The profile update timed out. Try saving it again.' 'Request timed out. Unlock again before reusing this ship.'))
::
++  cleanup
  |=  [rid=@ta req=managed-request:manor]
  ^-  (list card:agent:gall)
  =/  row  (~(got by ships.full) who.req)
  :~  [%pass /full-result/[rid] %agent [who.req transport.row] %leave ~]
      [%pass /full-timeout/[rid] %arvo %b %rest deadline.req]
  ==
::
++  failed
  |=  [rid=@ta reason=@t]
  ^-  (quip card managed-pool:manor)
  =/  req  (~(got by requests.full) rid)
  =/  row  (~(got by ships.full) who.req)
  =/  next
    ?:  =(%profile op.req)
      row(pending ?:(=(`rid pending.row) ~ pending.row), fault ?~(fault.row `reason fault.row))
    row(pending ~, blocked &, fault `reason)
  :_  %=  full
        requests  (~(del by requests.full) rid)
        ships     (~(put by ships.full) who.req next)
      ==
  (weld (cleanup rid req) ?~(eyre.req ~ (answer u.eyre.req 502 'The ship could not complete login. Ask the operator to unlock it.')))
::
++  finished
  |=  [rid=@ta result=result:manor-ship]
  ^-  (quip card managed-pool:manor)
  =/  req  (~(got by requests.full) rid)
  ?:  ?=(%error -.result)
    (failed rid ?:(=(%profile op.req) 'The ship could not save the profile. Try saving it again.' 'The companion reported a failure. Unlock before reuse.'))
  ?:  =(%profile op.req)
    ?.  ?=(?(%profile %profile-status) -.result)  (failed rid 'Expected a profile confirmation.')
    =/  cards  (cleanup rid req)
    ?:  ?=(%profile-status -.result)
      =.  full  (record-status who.req snapshot.result)
      =/  row  (~(got by ships.full) who.req)
      =?  row  &(!blocked.row =(~ pending.row))  row(fault ~)
      [cards full(requests (~(del by requests.full) rid), ships (~(put by ships.full) who.req row))]
    =/  row  (~(got by ships.full) who.req)
    =/  status  status.row
    =?  status  ?=(^ status)  `u.status(profile profile.result)
    =/  completed-legacy=?  &(=(%manor-moon transport.row) =(`rid pending.row))
    =?  status  &(completed-legacy ?=(^ status))  `u.status(busy |)
    =?  row  &(!blocked.row |(completed-legacy =(~ pending.row)))  row(fault ~)
    :_  %=  full
          requests  (~(del by requests.full) rid)
          ships     (~(put by ships.full) who.req row(pending ?:(completed-legacy ~ pending.row), status status))
        ==
    (snoc cards (command who.req /full-profile-report/(scot %p who.req) [%report ~]))
  ?:  =(%revoke op.req)
    ?.  ?=(%revoked -.result)  (failed rid 'Expected a revocation confirmation.')
    =/  row  (~(got by ships.full) who.req)
    =^  more  full  (clear-release who.req)
    :_  %=  full
          requests  (~(del by requests.full) rid)
          claims    (~(del by claims.full) who.req)
          ships     (~(put by ships.full) who.req row(pending ~, blocked |, fault ~))
        ==
    (weld more (cleanup rid req))
  ?.  ?=(%session -.result)  (failed rid 'Expected a visitor session.')
  =/  row  (~(got by ships.full) who.req)
  =/  c  (~(get by claims.full) who.req)
  ?~  c  (failed rid 'The claim was removed during login.')
  ?.  =(claim-at.req at.u.c)  (failed rid 'The claim changed during login.')
  =/  prefix  (rap 3 ~['urbauth-' (scot %p who.req) '='])
  =/  body  (rsh [3 (met 3 prefix)] cookie.result)
  ?.  =(`cookie.result (cookie:manor-ship who.req body))
    (failed rid 'The companion returned an invalid cookie.')
  ?~  eyre.req  (failed rid 'The login request was lost.')
  =/  status  (need status.row)
  =/  landing=@t  (rap 3 ~['/apps/' landing.status '/'])
  =/  key=@t  (scot %uv (sham eny.bowl [%manor-visit who.req claim-at.req rid serial.full]))
  =/  visitor=visitor:manor  [claim-at.req (sham key) ~ ~ ~ 0 ~ ~ 0 ~]
  =.  full
      %=  full
        requests  (~(del by requests.full) rid)
        claims    (~(put by claims.full) who.req u.c(entered `now.bowl))
        ships     (~(put by ships.full) who.req row(pending ~))
        visits    (~(put by visits.full) who.req visitor)
      ==
  =^  waiting  full  (await-first-tab who.req)
  :_  full
  %+  weld  (weld (cleanup rid req) waiting)
  %+  give-simple-payload:app:server  u.eyre.req
  [[303 ['set-cookie' (rap 3 ~[cookie.result '; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax' ?:(secure.req '; Secure' '')])] ['set-cookie' (rap 3 ~['manor-visit=' key '; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax' ?:(secure.req '; Secure' '')])] ['set-cookie' (rap 3 ~['manor-visit-id=' (scot %uv proof.visitor) '; Path=/; Max-Age=2592000; SameSite=Lax' ?:(secure.req '; Secure' '')])] ['location' landing] ['cache-control' 'no-store'] ~] ~]
::
::  Caddy supplies the external authority; direct network clients are refused.
++  origin
  |=  [req=inbound-request:eyre base=@t]
  ^-  (unit [scheme=@t suffix=@t])
  ?.  =([%ipv4 .127.0.0.1] address.req)  ~
  =/  host  (get-header:http 'x-forwarded-host' header-list.request.req)
  ?~  host  ~
  ?:  (local-trial req)
    =/  txt  (trip u.host)
    =/  colon  (need (find ":" txt))
    `['http' (cat 3 'localhost' (crip (slag colon txt)))]
  ?:  =('' base)  ~
  =/  tail  (cat 3 '.' base)
  =/  len  (met 3 u.host)
  =/  tlen  (met 3 tail)
  ?.  &((gth len tlen) =(tail (rsh [3 (sub len tlen)] u.host)))  ~
  `['https' base]
::
++  local-trial
  |=  req=inbound-request:eyre
  ^-  ?
  =/  host  (get-header:http 'x-forwarded-host' header-list.request.req)
  ?~  host  |
  =/  txt  (trip u.host)
  =/  colon  (find ":" txt)
  ?~  colon  |
  =/  name  (scag u.colon txt)
  =/  port  (rush (crip (slag +(u.colon) txt)) dem)
  ?~  port  |
  ?&  =([%ipv4 .127.0.0.1] address.req)
      (gte u.port 1.024)
      (lte u.port 65.535)
      |(=(name "join.localhost") (gth (lent name) 10))
      =(".localhost" (slag (sub (lent name) 10) name))
  ==
::
++  available
  |=  row=managed-ship:manor
  ^-  ?
  ?~  status.row  |
  ?&  online.row  !blocked.row  =(~ pending.row)
      ready.u.status.row  !busy.u.status.row
  ==
::
++  assign
  |=  [eyre-id=@ta req=inbound-request:eyre]
  ^-  (quip card managed-pool:manor)
  =/  target  (origin req '')
  ?~  target  [(answer eyre-id 403 'Use the configured visitor address.') full]
  (assign-at eyre-id req u.target)
::
++  assign-at
  |=  [eyre-id=@ta req=inbound-request:eyre target=[scheme=@t suffix=@t]]
  ^-  (quip card managed-pool:manor)
  =/  host  (get-header:http 'x-forwarded-host' header-list.request.req)
  ?.  =(`(cat 3 'join.' suffix.target) host)
    [(answer eyre-id 403 'Use the configured join address.') full]
  =/  live
    %-  malt
    %+  skip  ~(tap by claims.full)
    |=  [who=ship c=claim:manor]
    &(?=(~ entered.c) ?=(^ expires.c) (gte now.bowl u.expires.c))
  =.  full  full(claims live)
  =/  open
    %+  skim  ~(tap by ships.full)
    |=([who=ship row=managed-ship:manor] &(!(~(has by claims.full) who) (available row)))
  ?~  open  [(answer eyre-id 503 'No managed ship is available yet.') full]
  =/  who  p.i.open
  =/  ticket=@t  (scot %uv (sham eny.bowl [eyre-id serial.full]))
  =/  to  (rap 3 ~[scheme.target '://' (rsh 3 (scot %p who)) '.' suffix.target '/~manor/enter?ticket=' ticket])
  :_  full(claims (~(put by claims.full) who [now.bowl `(sham ticket) `(add now.bowl ~m2) ~]))
  %+  give-simple-payload:app:server  eyre-id
  [[302 ['location' to] ['cache-control' 'no-store'] ~] ~]
::
++  enter
  |=  [eyre-id=@ta req=inbound-request:eyre who=ship ticket=(unit @t)]
  ^-  (quip card managed-pool:manor)
  =/  target  (origin req '')
  ?~  target  [(answer eyre-id 403 'Use the assigned ship address.') full]
  (enter-at eyre-id req who ticket u.target)
::
++  enter-at
  |=  [eyre-id=@ta req=inbound-request:eyre who=ship ticket=(unit @t) target=[scheme=@t suffix=@t]]
  ^-  (quip card managed-pool:manor)
  =/  row  (~(get by ships.full) who)
  ?~  row  [(answer eyre-id 404 'This ship is not in the managed-ship pool.') full]
  =/  host  (get-header:http 'x-forwarded-host' header-list.request.req)
  =/  expected  (rap 3 ~[(rsh 3 (scot %p who)) '.' suffix.target])
  ?.  =(`expected host)
    [(answer eyre-id 403 'This link belongs on the assigned ship address.') full]
  =/  c  (~(get by claims.full) who)
  =/  valid=?
    ?~  c  |
    ?~  ticket  |
    ?~  ticket.u.c  |
    ?~  expires.u.c  |
    &(=(u.ticket.u.c (sham u.ticket)) (lth now.bowl u.expires.u.c))
  ?.  valid  [(answer eyre-id 403 'This link is expired or has already been used.') full]
  ?.  (available u.row)  [(answer eyre-id 503 'This ship is not ready for login.') full]
  =/  claim  (need c)
  ::  Consume before the asynchronous request: a replay cannot get a cookie.
  =.  full  full(claims (~(put by claims.full) who claim(ticket ~, expires ~)))
  (begin-secure who %session `eyre-id at.claim =('https' scheme.target))
::
++  answer
  |=  [id=@ta code=@ud text=@t]
  ^-  (list card:agent:gall)
  %+  give-simple-payload:app:server  id
  [[code ['content-type' 'text/plain; charset=utf-8'] ['cache-control' 'no-store'] ~] `[(met 3 text) text]]
::
++  json-state
  |=  public=?
  ^-  json
  %-  pairs:enjs:format
  :~  ['localOnly' b+!public]
      ['publicEnabled' b+public]
      ['idleMinutes' (numb:enjs:format idle-minutes.full)]
      [%ships a+(turn ~(tap by ships.full) json-moon)]
  ==
::
++  json-moon
  |=  [who=ship row=managed-ship:manor]
  ^-  json
  =/  c  (~(get by claims.full) who)
  =/  visit  (~(get by visits.full) who)
  %-  pairs:enjs:format
  :~  [%ship s+(scot %p who)]
      [%port (numb:enjs:format port.row)]
      [%transport s+transport.row]
      [%endpoint ?~(endpoint.row ~ (endpoint-json u.endpoint.row))]
      [%online b+online.row]
      [%ready b+(available row)]
      [%pending ?~(pending.row ~ s+op:(~(got by requests.full) u.pending.row))]
      ['profilePending' b+(profile-busy who)]
      [%blocked b+blocked.row]
      [%fault ?~(fault.row ~ s+u.fault.row)]
      ['autoUnlockAt' ?~(visit ~ ?~(deadline.u.visit ~ (ms u.deadline.u.visit)))]
      ['idleUnlockAt' ?~(visit ~ ?~(idle-at.u.visit ~ (ms u.idle-at.u.visit)))]
      [%profile ?~(status.row ~ ?~(profile.u.status.row ~ u.profile.u.status.row))]
      [%landing ?~(status.row ~ s+landing.u.status.row)]
      [%required a+?~(status.row ~ (turn ~(tap in required.u.status.row) |=(d=desk s+d)))]
      :-  %apps
      =/  installed  (~(get by apps.full) who)
      ?~  installed  ~
      :-  %a
      %+  turn  u.installed
      |=  [des=desk running=? web=?]
      (pairs:enjs:format ~[[%desk s+des] [%running b+running] [%web b+web]])
      [%generation ?~(status.row ~ (numb:enjs:format generation.u.status.row))]
      :-  %claim
      ?~  c  ~
      %-  pairs:enjs:format
      :~  [%at (ms at.u.c)]
          [%expires ?~(expires.u.c ~ (ms u.expires.u.c))]
          [%entered ?~(entered.u.c ~ (ms u.entered.u.c))]
      ==
  ==
::
++  endpoint-json
  |=  e=endpoint:manor
  ^-  json
  (pairs:enjs:format ~[[%host s+host.e] [%port (numb:enjs:format port.e)] [%secure b+secure.e]])
::
++  ms
  |=  date=@da
  ^-  json
  (numb:enjs:format (unm:chrono:userlib date))
--
