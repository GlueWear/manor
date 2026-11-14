::  Independent-moon pool. The public Theseus pool does not pass here.
/-  manor, manor-moon
/+  server
|_  [=bowl:gall full=full-pool:manor]
+$  card  card:agent:gall
::
++  watch-moon
  |=  who=ship
  ^-  card:agent:gall
  [%pass /full-status/(scot %p who) %agent [who %manor-moon] %watch /status]
::
++  register
  |=  who=ship
  ^-  (quip card _full)
  ?>  =(%earl (clan:title who))
  =/  prior  (~(get by moons.full) who)
  =/  row=full-moon:manor
    ?~  prior  [0 | ~ ~ & ~]
    u.prior(online |)
  [~[(watch-moon who)] full(moons (~(put by moons.full) who row))]
::
++  remove
  |=  who=ship
  ^-  (quip card _full)
  =/  row  (~(got by moons.full) who)
  ?>  =(~ pending.row)
  ?>  !(~(has by claims.full) who)
  :_  full(moons (~(del by moons.full) who))
  ~[[%pass /full-status/(scot %p who) %agent [who %manor-moon] %leave ~]]
::
++  unlock
  |=  who=ship
  ^-  (quip card _full)
  =/  row  (~(got by moons.full) who)
  ?>  online.row
  ?>  =(~ pending.row)
  (begin who %revoke ~ *@da)
::
::  Restarting the controller makes interrupted work indeterminate. Keep
::  its claims and quarantine the moon until a confirmed unlock.
++  resume
  ^-  (quip card _full)
  =/  out  full(requests ~)
  =|  cards=(list card:agent:gall)
  =/  todo  ~(tap by requests.full)
  =.  cards
    %-  zing
    %+  turn  todo
    |=  [rid=@ta req=full-request:manor]
    (weld (cleanup rid req) ?~(eyre.req ~ (answer u.eyre.req 502 'The controller restarted. Unlock this moon before retrying.')))
  =/  rows  ~(tap by moons.full)
  |-  ^-  (quip card _full)
  ?~  rows  [cards out]
  =/  [who=ship row=full-moon:manor]  i.rows
  =?  row  ?=(^ pending.row)
    row(blocked &, fault `'Controller restarted during a request.')
  =.  row  row(online |, pending ~)
  $(rows t.rows, cards (snoc cards (watch-moon who)), out out(moons (~(put by moons.out) who row)))
::
++  begin
  |=  [who=ship op=?(%session %revoke) eyre=(unit @ta) claim-at=@da]
  ^-  (quip card _full)
  =/  row  (~(got by moons.full) who)
  ?>  =(~ pending.row)
  =/  serial  +(serial.full)
  =/  rid=@ta  (crip "manor-{(a-co:co serial)}")
  =/  deadline  (add now.bowl ~s45)
  =/  req=full-request:manor  [who op eyre claim-at deadline]
  =/  action=action:manor-moon
    ?:  =(%session op)  [%session rid]
    [%revoke rid]
  :_  %=  full
        serial    serial
        moons     (~(put by moons.full) who row(pending `rid, fault ~))
        requests  (~(put by requests.full) rid req)
      ==
  :~  [%pass /full-result/[rid] %agent [who %manor-moon] %watch /result/[rid]]
      [%pass /full-ask/[rid] %agent [who %manor-moon] %poke %manor-moon-action !>(action)]
      [%pass /full-timeout/[rid] %arvo %b %wait deadline]
  ==
::
++  receive
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _full)
  ?:  ?=([%full-status @ ~] wire)
    =/  who  (slav %p i.t.wire)
    =/  got  (~(get by moons.full) who)
    ?~  got  `full
    =/  row  u.got
    ?:  ?=(%fact -.sign)
      =/  status  ;;(status:manor-moon q.q.cage.sign)
      =/  own-port  .^([@ud (unit @ud)] %e /(scot %p our.bowl)/ports/(scot %da now.bowl))
      =/  port-ok=?
        ?&  (gte port.status 1.024)
            (lte port.status 65.535)
            |(=(0 port.row) =(port.row port.status))
            !=(port.status -.own-port)
            %+  levy  ~(tap by moons.full)
            |=([s=ship m=full-moon:manor] |(=(s who) !=(port.m port.status)))
        ==
      =/  ok  &(=(who who.status) =(`our.bowl controller.status) port-ok)
      `full(moons (~(put by moons.full) who row(online ok, status `status, port ?:(ok port.status port.row))))
    ?:  |(?=(%kick -.sign) &(?=(%watch-ack -.sign) ?=(^ p.sign)))
      `full(moons (~(put by moons.full) who row(online |)))
    `full
  ?.  ?=([?(%full-result %full-ask) @ ~] wire)  `full
  =/  rid=@ta  i.t.wire
  =/  req  (~(get by requests.full) rid)
  ?~  req  `full
  ?:  ?=([%full-ask *] wire)
    ?:  &(?=(%poke-ack -.sign) ?=(^ p.sign))  (failed rid 'The moon refused the request.')
    `full
  ?:  ?=(%fact -.sign)
    =/  reply  ;;(reply:manor-moon q.q.cage.sign)
    ?.  =(rid rid.reply)  (failed rid 'The moon returned a mismatched request.')
    (finished rid result.reply)
  ?:  |(?=(%kick -.sign) &(?=(%watch-ack -.sign) ?=(^ p.sign)))
    (failed rid 'The moon did not complete the request.')
  `full
::
++  timeout
  |=  rid=@ta
  ^-  (quip card _full)
  =/  req  (~(get by requests.full) rid)
  ?~  req  `full
  ?:  (lth now.bowl deadline.u.req)  `full
  (failed rid 'Request timed out. Unlock again before reusing this moon.')
::
++  cleanup
  |=  [rid=@ta req=full-request:manor]
  ^-  (list card:agent:gall)
  :~  [%pass /full-result/[rid] %agent [who.req %manor-moon] %leave ~]
      [%pass /full-timeout/[rid] %arvo %b %rest deadline.req]
  ==
::
++  failed
  |=  [rid=@ta reason=@t]
  ^-  (quip card _full)
  =/  req  (~(got by requests.full) rid)
  =/  row  (~(got by moons.full) who.req)
  :_  %=  full
        requests  (~(del by requests.full) rid)
        moons     (~(put by moons.full) who.req row(pending ~, blocked &, fault `reason))
      ==
  (weld (cleanup rid req) ?~(eyre.req ~ (answer u.eyre.req 502 'The moon could not complete login. Ask the operator to unlock it.')))
::
++  finished
  |=  [rid=@ta result=result:manor-moon]
  ^-  (quip card _full)
  =/  req  (~(got by requests.full) rid)
  ?:  ?=(%error -.result)  (failed rid 'The companion reported a failure. Unlock before reuse.')
  ?:  =(%revoke op.req)
    ?.  ?=(%revoked -.result)  (failed rid 'Expected a revocation confirmation.')
    =/  row  (~(got by moons.full) who.req)
    :_  %=  full
          requests  (~(del by requests.full) rid)
          claims    (~(del by claims.full) who.req)
          moons     (~(put by moons.full) who.req row(pending ~, blocked |, fault ~))
        ==
    (cleanup rid req)
  ?.  ?=(%session -.result)  (failed rid 'Expected a visitor session.')
  =/  row  (~(got by moons.full) who.req)
  =/  c  (~(get by claims.full) who.req)
  ?~  c  (failed rid 'The claim was removed during login.')
  ?.  =(claim-at.req at.u.c)  (failed rid 'The claim changed during login.')
  =/  prefix  (rap 3 ~['urbauth-' (scot %p who.req) '='])
  =/  body  (rsh [3 (met 3 prefix)] cookie.result)
  ?.  =(`cookie.result (cookie:manor-moon who.req body))
    (failed rid 'The companion returned an invalid cookie.')
  ?~  eyre.req  (failed rid 'The login request was lost.')
  =/  status  (need status.row)
  =/  landing=@t  (rap 3 ~['/apps/' landing.status '/'])
  :_  %=  full
        requests  (~(del by requests.full) rid)
        claims    (~(put by claims.full) who.req u.c(entered `now.bowl))
        moons     (~(put by moons.full) who.req row(pending ~))
      ==
  %+  weld  (cleanup rid req)
  %+  give-simple-payload:app:server  u.eyre.req
  [[303 ['set-cookie' (cat 3 cookie.result '; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax')] ['location' landing] ['cache-control' 'no-store'] ~] ~]
::
::  Only the isolated loopback Caddy preview may use this pool.
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
  |=  row=full-moon:manor
  ^-  ?
  ?~  status.row  |
  ?&  online.row  !blocked.row  =(~ pending.row)
      ready.u.status.row  !busy.u.status.row
  ==
::
++  assign
  |=  [eyre-id=@ta req=inbound-request:eyre]
  ^-  (quip card _full)
  =/  live
    %-  malt
    %+  skip  ~(tap by claims.full)
    |=  [who=ship c=claim:manor]
    &(?=(~ entered.c) ?=(^ expires.c) (gte now.bowl u.expires.c))
  =.  full  full(claims live)
  =/  open
    %+  skim  ~(tap by moons.full)
    |=([who=ship row=full-moon:manor] &(!(~(has by claims.full) who) (available row)))
  ?~  open  [(answer eyre-id 503 'No full moon is available yet.') full]
  =/  who  p.i.open
  =/  ticket=@t  (scot %uv (sham eny.bowl [eyre-id serial.full]))
  =/  host  (need (get-header:http 'x-forwarded-host' header-list.request.req))
  =/  to  (rap 3 ~['http://' (rsh 3 (scot %p who)) '.' (rsh [3 5] host) '/~manor/enter?ticket=' ticket])
  :_  full(claims (~(put by claims.full) who [now.bowl `(sham ticket) `(add now.bowl ~m2) ~]))
  %+  give-simple-payload:app:server  eyre-id
  [[302 ['location' to] ['cache-control' 'no-store'] ~] ~]
::
++  enter
  |=  [eyre-id=@ta req=inbound-request:eyre who=ship ticket=(unit @t)]
  ^-  (quip card _full)
  =/  row  (~(get by moons.full) who)
  ?~  row  [(answer eyre-id 404 'This moon is not in the full-moon pool.') full]
  =/  host  (get-header:http 'x-forwarded-host' header-list.request.req)
  =/  expected  (rap 3 ~[(rsh 3 (scot %p who)) '.localhost:'])
  ?.  ?~(host | =(expected (end [3 (met 3 expected)] u.host)))
    [(answer eyre-id 403 'This link belongs on the assigned moon address.') full]
  =/  c  (~(get by claims.full) who)
  =/  valid=?
    ?~  c  |
    ?~  ticket  |
    ?~  ticket.u.c  |
    ?~  expires.u.c  |
    &(=(u.ticket.u.c (sham u.ticket)) (lth now.bowl u.expires.u.c))
  ?.  valid  [(answer eyre-id 403 'This link is expired or has already been used.') full]
  ?.  (available u.row)  [(answer eyre-id 503 'This moon is not ready for login.') full]
  =/  claim  (need c)
  ::  Consume before the asynchronous request: a replay cannot get a cookie.
  =.  full  full(claims (~(put by claims.full) who claim(ticket ~, expires ~)))
  (begin who %session `eyre-id at.claim)
::
++  answer
  |=  [id=@ta code=@ud text=@t]
  ^-  (list card:agent:gall)
  %+  give-simple-payload:app:server  id
  [[code ['content-type' 'text/plain; charset=utf-8'] ['cache-control' 'no-store'] ~] `[(met 3 text) text]]
::
++  json-state
  ^-  json
  %-  pairs:enjs:format
  :~  ['localOnly' b+&]
      [%moons a+(turn ~(tap by moons.full) json-moon)]
  ==
::
++  json-moon
  |=  [who=ship row=full-moon:manor]
  ^-  json
  =/  c  (~(get by claims.full) who)
  %-  pairs:enjs:format
  :~  [%ship s+(scot %p who)]
      [%port (numb:enjs:format port.row)]
      [%online b+online.row]
      [%ready b+(available row)]
      [%pending ?~(pending.row ~ s+op:(~(got by requests.full) u.pending.row))]
      [%blocked b+blocked.row]
      [%fault ?~(fault.row ~ s+u.fault.row)]
      [%profile ?~(status.row ~ ?~(profile.u.status.row ~ u.profile.u.status.row))]
      [%landing ?~(status.row ~ s+landing.u.status.row)]
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
++  ms
  |=  date=@da
  ^-  json
  (numb:enjs:format (unm:chrono:userlib date))
--
