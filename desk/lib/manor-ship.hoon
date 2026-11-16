::  Managed-ship operations used by the single %manor agent.
/-  manor-ship
|_  [=bowl:gall [controller=(unit ship) landing=desk required=(set desk) pending=(unit work:manor-ship) serial=@ud generation=@ud]]
+$  card  card:agent:gall
++  state
  ^-  local-state:manor-ship
  [controller landing required pending serial generation]
++  authorized
  (allowed:manor-ship our.bowl src.bowl controller)
++  agent-running
  |=  name=term
  ^-  ?
  .^(? %gu /(scot %p our.bowl)/[name]/(scot %da now.bowl)/$)
++  bootstrap
  ^-  local-state:manor-ship
  ::  A missing scry can escape +mole during Gall's state load. Check
  ::  Gall's always-defined running flag before reading an optional agent.
  ?.  (agent-running %manor-moon)  initial:manor-ship
  =/  old
    %-  mole  |.
    .^(status:manor-ship %gx /(scot %p our.bowl)/manor-moon/(scot %da now.bowl)/status/noun)
  ?~  old  initial:manor-ship
  ?.  &(=(who.u.old our.bowl) !busy.u.old)  initial:manor-ship
  [controller.u.old landing.u.old required.u.old ~ 0 generation.u.old]
++  resume
  ^-  (quip card local-state:manor-ship)
  =/  cards  (weld watches announce)
  ?:  =(~ pending)  [cards state]
  =/  done  (finish [%error 'Manor reloaded during a control request; confirm the result before reuse.'])
  [(weld cards -.done) +.done]
++  announce
  ^-  (list card)
  ?~  controller  ~
  ~[[%pass /ship-pair-request %agent [u.controller %manor] %poke %manor-pair-request !>(~)]]
++  watch
  |=  pax=path
  ^-  (list card)
  ?>  authorized
  ?+  pax  !!
    [%status ~]    ~[[%give %fact ~ %noun !>(snapshot)]]
    [%apps ~]      ~[[%give %fact ~ %noun !>(inventory)]]
    [%result @ ~]  ~
  ==
++  watches
  ^-  (list card)
  ?:  =(~ controller)  ~
  =/  out=(list card)  ~
  =?  out  !(~(has by wex.bowl) [/ship-kiln our.bowl %hood])
    [[%pass /ship-kiln %agent [our.bowl %hood] %watch /kiln/updates] out]
  =?  out  !(~(has by wex.bowl) [/ship-profile-updates our.bowl %noltbook])
    [[%pass /ship-profile-updates %agent [our.bowl %noltbook] %watch /notes] out]
  out
++  port
  ^-  @ud
  -:.^([@ud (unit @ud)] %e /(scot %p our.bowl)/ports/(scot %da now.bowl))
++  own-profile
  ^-  (unit json)
  ?.  (agent-running %noltbook)  ~
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
++  inventory
  ^-  (list installed-app:manor-ship)
  =/  rock  .^(rock:tire:clay %cx /(scot %p our.bowl)//(scot %da now.bowl)/tire)
  %+  turn  ~(tap by rock)
  |=  [des=desk pik=[zest=zest:clay wic=(set weft)]]
  :*  des
      =(%live zest.pik)
      |(=(des %landscape) .^(? %cu /(scot %p our.bowl)/[des]/(scot %da now.bowl)/desk/docket-0))
  ==
++  inventory-json
  ^-  json
  :-  %a
  %+  turn  inventory
  |=  [des=desk running=? web=?]
  (pairs:enjs:format ~[[%desk s+des] [%running b+running] [%web b+web]])
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
  ^-  status:manor-ship
  =/  busy=?  ?~(pending | !=(%profile op.u.pending))
  [our.bowl controller port landing required landing-ready busy generation own-profile]
++  signal-status
  ^-  card
  [%give %fact ~[/status] %noun !>(snapshot)]
++  act
  |=  a=action:manor-ship
  ^-  (quip card local-state:manor-ship)
  ?:  ?=([%pair *] a)
    ?>  =(src.bowl our.bowl)
    ?>  =(~ pending)
    ?>  ?~(controller.a & !=(u.controller.a our.bowl))
    =/  paths=(list path)
      %+  murn  ~(tap by sup.bowl)
      |=  [duc=duct who=ship pax=path]
      ?.(|(?=([%status ~] pax) ?=([%apps ~] pax) ?=([%result @ ~] pax)) ~ `pax)
    =.  controller  controller.a
    =/  kicks=(list card)  ?~(paths ~ ~[[%give %kick paths ~]])
    [(weld kicks (weld watches announce)) state]
  ?>  authorized
  ?:  ?=([%report ~] a)  [~[signal-status] state]
  ?:  ?=([%configure *] a)
    ?>  =(~ pending)
    ?>  (lte ~(wyt in required.a) 32)
    =.  landing  landing.a
    =.  required  (~(put in required.a) landing.a)
    [~[signal-status] state]
  =/  rid=@ta
    ?:  ?=([%profile *] a)  rid.a
    +.a
  ?>  (valid-rid:manor-ship rid)
  =/  pax=path  /result/[rid]
  ?>  %+  lien  ~(tap by sup.bowl)
      |=  [duc=duct who=ship sub=path]
      &(=(who src.bowl) =(sub pax))
  ?:  ?=([%profile *] a)
    ?>  (valid-profile:manor-ship name.a avatar.a)
    =/  update
      :*  %update-profile  ~  name.a
          ?~(avatar.a [%keep ~] ?~(u.avatar.a [%clear ~] [%set %external u.u.avatar.a]))
          ~  ~
      ==
    =.  serial  +(serial)
    =/  deadline  (add now.bowl ~s30)
    :_  state
    :~  [%pass /ship-profile/[rid]/(scot %ud serial)/(scot %da deadline) %agent [our.bowl %noltbook] %poke-as %noltbook-api noun+!>(update)]
        [%pass /ship-profile-timeout/[rid]/(scot %ud serial)/(scot %da deadline) %arvo %b %wait deadline]
    ==
  ?>  =(~ pending)
  ?:  &(?=([%session *] a) !landing-ready)
    :_  state
    :~  [%give %fact ~[pax] %noun !>(`reply:manor-ship`[rid %error 'Landing desks are not running.'])]
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
  [%pass /ship-timeout/(scot %ud serial.j) %arvo %b %wait deadline.j]
++  http-card
  |=  [stage=@tas method=method:http url=@t headers=header-list:http data=@t]
  ^-  card
  =/  j  (need pending)
  =/  target=@t  (rap 3 ~['http://127.0.0.1:' (crip (a-co:co port)) url])
  :*  %pass  /ship-http/(scot %ud serial.j)/[stage]  %arvo  %i  %request
      [method target headers `(as-octs:mimes:html data)]
      [0 0]
  ==
++  login-card
  ^-  card
  =/  code  .^(@p %j /(scot %p our.bowl)/code/(scot %da now.bowl)/(scot %p our.bowl))
  =/  password=@t  (rsh 3 (scot %p code))
  (http-card %login %'POST' '/~/login' ~[['content-type' 'application/x-www-form-urlencoded']] (cat 3 'password=' password))
++  finish
  |=  result=result:manor-ship
  ^-  (quip card local-state:manor-ship)
  =/  j  (need pending)
  =.  pending  ~
  :_  state
  :~  [%give %fact ~[/result/[rid.j]] %noun !>(`reply:manor-ship`[rid.j result])]
      [%give %kick ~[/result/[rid.j]] ~]
      [%pass /ship-timeout/(scot %ud serial.j) %arvo %b %rest deadline.j]
      signal-status
  ==
++  finish-profile
  |=  [rid=@ta seq=@ud deadline=@da result=result:manor-ship]
  ^-  (quip card local-state:manor-ship)
  :_  state
  :~  [%give %fact ~[/result/[rid]] %noun !>(`reply:manor-ship`[rid result])]
      [%give %kick ~[/result/[rid]] ~]
      [%pass /ship-profile-timeout/[rid]/(scot %ud seq)/(scot %da deadline) %arvo %b %rest deadline]
  ==
++  agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card local-state:manor-ship)
  ?:  =(wire /ship-pair-request)  `state
  ?:  |(=(wire /ship-kiln) =(wire /ship-profile-updates))
    ?.  ?=(%fact -.sign)  `state
    ?:  =(wire /ship-profile-updates)
      ?.  =(%noltbook-update p.cage.sign)  `state
      =/  upd=*  q.q.cage.sign
      ?.  ?=([%profile-updated @ *] upd)  `state
      ?.  =(our.bowl +<.upd)  `state
      [~[signal-status] state]
    [(weld watches ~[signal-status [%give %fact ~[/apps] %noun !>(inventory)]]) state]
  ?:  ?=([%ship-profile @ @ @ ~] wire)
    ?.  ?=(%poke-ack -.sign)  `state
    =/  result=result:manor-ship
      ?^(p.sign [%error 'Noltbook refused the profile update.'] [%profile-status snapshot])
    (finish-profile i.t.wire (slav %ud i.t.t.wire) (slav %da i.t.t.t.wire) result)
  ?:  =(~ pending)  `state
  =/  j  (need pending)
  ?.  &(=(wire /ship-profile/(scot %ud serial.j)) ?=(%poke-ack -.sign))  `state
  ?^  p.sign  (finish [%error 'Noltbook refused the profile update.'])
  (finish [%profile own-profile])
++  arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card local-state:manor-ship)
  ?:  ?=([%ship-profile-timeout @ @ @ ~] wire)
    ?.  ?=([%behn %wake ~] sign)  `state
    (finish-profile i.t.wire (slav %ud i.t.t.wire) (slav %da i.t.t.t.wire) [%error 'Profile confirmation timed out; the ship remains available.'])
  ?:  =(~ pending)  `state
  =/  j  (need pending)
  ?:  &(=(wire /ship-timeout/(scot %ud serial.j)) ?=([%behn %wake *] sign))
    =/  done  (finish [%error 'Ship control request timed out; do not assume the action did not run.'])
    ?:  =(%profile stage.j)  done
    [[[%pass /ship-http/(scot %ud serial.j)/[stage.j] %arvo %i %cancel-request ~] -.done] +.done]
  ?.  &(=(wire /ship-http/(scot %ud serial.j)/[stage.j]) ?=([%iris %http-response *] sign))  `state
  =*  res  client-response.sign
  ?:  ?=(%progress -.res)
    ?.  (gth bytes-read.res 8.192)  `state
    =/  done  (finish [%error 'Ship login response exceeded its size limit.'])
    [[[%pass wire %arvo %i %cancel-request ~] -.done] +.done]
  ?:  ?=(%cancel -.res)  (finish [%error 'Ship HTTP request was interrupted.'])
  ?:  =(%logout stage.j)
    ?.  =(303 status-code.response-header.res)
      (finish [%error 'Ship logout was not confirmed.'])
    ?.  owner-sessions-cleared  (finish [%error 'Owner sessions remain; this ship must not be freed.'])
    =.  generation  +(generation)
    (finish [%revoked generation])
  ?.  =(200 status-code.response-header.res)
    (finish [%error 'Ship Eyre refused the login request.'])
  ?~  full-file.res  (finish [%error 'Ship Eyre returned no session.'])
  ?~  got=(cookie:manor-ship our.bowl q.data.u.full-file.res)
    (finish [%error 'Ship Eyre returned an invalid session.'])
  ?:  =(%session op.j)  (finish [%session u.got])
  =.  pending  `j(stage %logout)
  :_  state
  ~[(http-card %logout %'POST' '/~/logout' ~[['cookie' u.got] ['content-type' 'application/x-www-form-urlencoded']] 'all=1')]
--
