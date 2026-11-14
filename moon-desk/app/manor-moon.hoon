::  Full-moon companion. No HTTP routes; codes never leave this ship.
/-  manor-moon
|%
+$  state-0
  $:  %0
      controller=(unit ship)
      landing=desk
      required=(set desk)
      pending=(unit work:manor-moon)
      serial=@ud
      generation=@ud
  ==
+$  card  card:agent:gall
--
=|  state-0
=*  state  -
=<
^-  agent:gall
|_  =bowl:gall
+*  this  .
    hc    ~(. +> bowl)
++  on-init
  :_  this(landing %glurff, required (silt `(list desk)`~[%glurff %noltbook]))
  watches:hc
++  on-save  !>(state)
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  =/  got  !<(state-0 old)
  [watches:hc this(state got)]
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?>  =(%manor-moon-action mark)
  =^  cards  state  (act:hc !<(action:manor-moon vase))
  [cards this]
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?>  authorized:hc
  ?+  path  ~|(%manor-moon-bad-watch !!)
    [%status ~]    [~[[%give %fact ~ %noun !>(snapshot:hc)]] this]
    [%result @ ~]  `this
  ==
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?>  authorized:hc
  ?+  path  ~
    [%x %status ~]  ``noun+!>(snapshot:hc)
  ==
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  =^  cards  state  (agent:hc wire sign)
  [cards this]
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  =^  cards  state  (arvo:hc wire sign-arvo)
  [cards this]
++  on-leave
  |=  =path
  `this
++  on-fail
  |=  [=term =tang]
  `this
--
|_  =bowl:gall
++  authorized
  (allowed:manor-moon our.bowl src.bowl controller)
++  watches
  ^-  (list card)
  =/  out=(list card)  ~
  =?  out  !(~(has by wex.bowl) [/kiln our.bowl %hood])
    [[%pass /kiln %agent [our.bowl %hood] %watch /kiln/updates] out]
  =?  out  !(~(has by wex.bowl) [/profile-updates our.bowl %noltbook])
    [[%pass /profile-updates %agent [our.bowl %noltbook] %watch /notes] out]
  out
++  port
  ^-  @ud
  -:.^([@ud (unit @ud)] %e /(scot %p our.bowl)/ports/(scot %da now.bowl))
++  own-profile
  ^-  (unit json)
  (mole |.(.^(json %gx /(scot %p our.bowl)/noltbook/(scot %da now.bowl)/api/profile/(scot %p our.bowl)/json)))
++  landing-ready
  ^-  ?
  =/  got
    %-  mole  |.
    =/  rock  .^(rock:tire:clay %cx /(scot %p our.bowl)//(scot %da now.bowl)/tire)
    %+  levy  ~(tap in required)
    |=  des=desk
    =/  pik  (~(get by rock) des)
    ?~  pik  |
    =(%live zest.u.pik)
  ?~(got | u.got)
++  owner-sessions-cleared
  ^-  ?
  =/  checked
    %-  mole  |.
    =/  auth  .^(authentication-state:eyre %e /(scot %p our.bowl)/authentication-state/(scot %da now.bowl))
    %+  levy  ~(tap by sessions.auth)
    |=  [sid=@uv sess=session:eyre]
    !?=(%ours -.identity.sess)
  ?=([~ %.y] checked)
++  snapshot
  ^-  status:manor-moon
  [our.bowl controller port landing required landing-ready ?=(^ pending) generation own-profile]
++  signal-status
  ^-  card
  [%give %fact ~[/status] %noun !>(snapshot)]
++  act
  |=  a=action:manor-moon
  ^-  (quip card _state)
  ?:  ?=([%pair *] a)
    ?>  =(src.bowl our.bowl)
    ?>  =(~ pending)
    =/  paths=(list path)
      (turn ~(tap by sup.bowl) |=([duc=duct who=ship pax=path] pax))
    [?~(paths ~ ~[[%give %kick paths ~]]) state(controller controller.a)]
  ?>  authorized
  ?:  ?=([%report ~] a)  [~[signal-status] state]
  ?>  =(~ pending)
  ?:  ?=([%configure *] a)
    ?>  (lte ~(wyt in required.a) 32)
    =.  state  state(landing landing.a, required (~(put in required.a) landing.a))
    [~[signal-status] state]
  =/  rid=@ta
    ?:  ?=([%profile *] a)  rid.a
    +.a
  ?>  (valid-rid:manor-moon rid)
  =/  pax=path  /result/[rid]
  ?>  %+  lien  ~(tap by sup.bowl)
      |=  [duc=duct who=ship sub=path]
      &(=(who src.bowl) =(sub pax))
  ?:  ?=([%profile *] a)
    ?>  (valid-profile:manor-moon name.a avatar.a)
    =/  update
      :*  %update-profile  ~  name.a
          ?~(avatar.a [%keep ~] ?~(u.avatar.a [%clear ~] [%set %external u.u.avatar.a]))
          ~  ~
      ==
    =.  serial  +(serial)
    =.  pending  `[rid %profile %profile serial (add now.bowl ~s30)]
    :_  state
    :~  [%pass /profile/(scot %ud serial) %agent [our.bowl %noltbook] %poke-as %noltbook-api noun+!>(update)]
        timeout-card
        signal-status
    ==
  ?:  &(?=([%session *] a) !landing-ready)
    :_  state
    :~  [%give %fact ~[pax] %noun !>(`reply:manor-moon`[rid %error 'Landing desks are not running.'])]
        [%give %kick ~[pax] ~]
    ==
  =.  serial  +(serial)
  =.  pending  `[rid -.a %login serial (add now.bowl ~s30)]
  :_  state
  :~  login-card
      timeout-card
      signal-status
  ==
++  timeout-card
  ^-  card
  =/  j  (need pending)
  [%pass /timeout/(scot %ud serial.j) %arvo %b %wait deadline.j]
++  http-card
  |=  [stage=@tas method=method:http url=@t headers=header-list:http data=@t]
  ^-  card
  =/  j  (need pending)
  =/  target=@t  (rap 3 ~['http://127.0.0.1:' (crip (a-co:co port)) url])
  :*  %pass  /http/(scot %ud serial.j)/[stage]  %arvo  %i  %request
      [method target headers `(as-octs:mimes:html data)]
      [0 0]
  ==
++  login-card
  ^-  card
  =/  code  .^(@p %j /(scot %p our.bowl)/code/(scot %da now.bowl)/(scot %p our.bowl))
  =/  password=@t  (rsh 3 (scot %p code))
  (http-card %login %'POST' '/~/login' ~[['content-type' 'application/x-www-form-urlencoded']] (cat 3 'password=' password))
++  finish
  |=  result=result:manor-moon
  ^-  (quip card _state)
  =/  j  (need pending)
  =.  pending  ~
  :_  state
  :~  [%give %fact ~[/result/[rid.j]] %noun !>(`reply:manor-moon`[rid.j result])]
      [%give %kick ~[/result/[rid.j]] ~]
      [%pass /timeout/(scot %ud serial.j) %arvo %b %rest deadline.j]
      signal-status
  ==
++  agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _state)
  ?:  |(=(wire /kiln) =(wire /profile-updates))
    ?.  ?=(%fact -.sign)  `state
    ?:  =(wire /profile-updates)
      ?.  =(%noltbook-update p.cage.sign)  `state
      =/  upd=*  q.q.cage.sign
      ?.  ?=([%profile-updated @ *] upd)  `state
      ?.  =(our.bowl +<.upd)  `state
      [~[signal-status] state]
    [(snoc watches signal-status) state]
  ?:  =(~ pending)  `state
  =/  j  (need pending)
  ?.  &(=(wire /profile/(scot %ud serial.j)) ?=(%poke-ack -.sign))  `state
  ?^  p.sign  (finish [%error 'Noltbook refused the profile update.'])
  (finish [%profile own-profile])
++  arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card _state)
  ?:  =(~ pending)  `state
  =/  j  (need pending)
  ?:  &(=(wire /timeout/(scot %ud serial.j)) ?=([%behn %wake *] sign))
    =/  done  (finish [%error 'Moon control request timed out; do not assume the action did not run.'])
    ?:  =(%profile stage.j)  done
    [[[%pass /http/(scot %ud serial.j)/[stage.j] %arvo %i %cancel-request ~] -.done] +.done]
  ?.  &(=(wire /http/(scot %ud serial.j)/[stage.j]) ?=([%iris %http-response *] sign))  `state
  =*  res  client-response.sign
  ?:  ?=(%progress -.res)
    ?.  (gth bytes-read.res 8.192)  `state
    =/  done  (finish [%error 'Moon login response exceeded its size limit.'])
    [[[%pass wire %arvo %i %cancel-request ~] -.done] +.done]
  ?:  ?=(%cancel -.res)  (finish [%error 'Moon HTTP request was interrupted.'])
  ?:  =(%logout stage.j)
    ?.  =(303 status-code.response-header.res)
      (finish [%error 'Moon logout was not confirmed.'])
    ?.  owner-sessions-cleared  (finish [%error 'Owner sessions remain; this moon must not be freed.'])
    =.  generation  +(generation)
    (finish [%revoked generation])
  ?.  =(200 status-code.response-header.res)
    (finish [%error 'Moon Eyre refused the login request.'])
  ?~  full-file.res  (finish [%error 'Moon Eyre returned no session.'])
  ?~  got=(cookie:manor-moon our.bowl q.data.u.full-file.res)
    (finish [%error 'Moon Eyre returned an invalid session.'])
  ?:  =(%session op.j)  (finish [%session u.got])
  =.  pending  `j(stage %logout)
  :_  state
  ~[(http-card %logout %'POST' '/~/logout' ~[['cookie' u.got] ['content-type' 'application/x-www-form-urlencoded']] 'all=1')]
--
