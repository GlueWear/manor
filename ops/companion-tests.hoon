::  Runs after the protocol and ctor are bound by check_companion.py.
::  Agent calls compute cards, but these tests never deliver those cards.
=/  own=ship  ~pilfep-sicted-mignes-magtel
=/  king=ship  ~siglup-narwet
=/  other=ship  ~zod
=/  saved
  $:  %0  controller=(unit ship)  landing=desk  required=(set desk)
      pending=(unit work:manor-moon)  serial=@ud  generation=@ud
  ==
~|  %permissions
?>  (allowed:manor-moon own own ~)
?<  (allowed:manor-moon own other ~)
?>  (allowed:manor-moon own king `king)
?<  (allowed:manor-moon own other `king)
~|  %request-ids
?>  (valid-rid:manor-moon 'test-1')
?<  (valid-rid:manor-moon '')
?<  (valid-rid:manor-moon '../other')
?<  (valid-rid:manor-moon (rap 3 (reap 81 'a')))
~|  %profile-validation
?>  (valid-profile:manor-moon ~ ~)
?>  (valid-profile:manor-moon ``'Name' ``'https://example.com/image.png')
?<  (valid-profile:manor-moon ``(rap 3 (reap 257 'a')) ~)
?<  (valid-profile:manor-moon ~ ``'javascript:alert(1)')
~|  %cookie-validation
?>  =(`'urbauth-~zod=0v1' (cookie:manor-moon ~zod '0v1'))
?>  =(~ (cookie:manor-moon own '0v0'))
?>  =(~ (cookie:manor-moon own '0v1; bad=1'))
~|  %initial-state
=/  b=bowl:gall
  %*(. *bowl:gall our own, src own, dap %manor-moon, now ~2026.11.12)
=/  fresh  ~(. ctor b)
=/  initialized  on-init.fresh
=/  app  +.initialized
=/  initial  !<(saved on-save.app)
?>  =(~ controller.initial)
?>  =(%glurff landing.initial)
?>  (~(has in required.initial) %glurff)
?>  (~(has in required.initial) %noltbook)
~|  %remote-cannot-pair-or-watch
=/  stranger  app(+< b(src other))
?>  =(~ (mole |.((on-watch.stranger /status))))
?>  =(~ (mole |.((on-watch.stranger /result/test-1))))
?>  =(~ (mole |.((on-poke.stranger %manor-moon-action !>(`action:manor-moon`[%pair `other])))))
~|  %local-pairing
=/  pair-result  (on-poke.app %manor-moon-action !>(`action:manor-moon`[%pair `king]))
?>  =(~ -.pair-result)
=/  paired  +.pair-result
=/  state-paired  !<(saved on-save.paired)
?>  =(`king controller.state-paired)
=/  controller  paired(+< b(src king))
?>  ?=(^ (mole |.((on-watch.controller /status))))
?>  =(~ (mole |.((on-poke.controller %manor-moon-action !>(`action:manor-moon`[%pair `other])))))
~|  %request-needs-a-watch
?>  =(~ (mole |.((on-poke.controller %manor-moon-action !>(`action:manor-moon`[%profile 'test-1' ~ ~])))))
=.  b  b(src king, sup (~(put by sup.b) ~ [king /result/test-1]))
=.  controller  controller(+< b)
~|  %profile-job
=/  started  (on-poke.controller %manor-moon-action !>(`action:manor-moon`[%profile 'test-1' ~ ~]))
=/  busy  +.started
=/  running  !<(saved on-save.busy)
?>  =(3 (lent -.started))
?>  ?=([~ *] pending.running)
?>  =(1 serial.running)
~|  %busy-requests-are-refused
?>  =(~ (mole |.((on-poke.busy %manor-moon-action !>(`action:manor-moon`[%profile 'test-1' ~ ~])))))
~|  %stale-ack-is-ignored
=/  stale  +:(on-agent.busy /profile/0 [%poke-ack ~])
?>  =(on-save.busy on-save.stale)
~|  %ack-clears-job
=/  finished  +:(on-agent.busy /profile/1 [%poke-ack ~])
=/  completed  !<(saved on-save.finished)
?>  =(~ pending.completed)
~|  %timeout-clears-job
=/  timed-out  +:(on-arvo.busy /timeout/1 [%behn %wake ~])
=/  timed  !<(saved on-save.timed-out)
?>  =(~ pending.timed)
?>  =(0 generation.timed)
~|  %new-job-has-new-serial
=/  again  +:(on-poke.timed-out %manor-moon-action !>(`action:manor-moon`[%profile 'test-1' ~ ~]))
=/  next  !<(saved on-save.again)
?>  =(2 serial.next)
=/  late  +:(on-agent.again /profile/1 [%poke-ack ~])
?>  =(on-save.again on-save.late)
~|  %session-result-keeps-no-cookie-in-agent-state
=/  login  +:(on-poke.finished %manor-moon-action !>(`action:manor-moon`[%session 'test-1']))
~|  %url-port-has-no-grouping-dots
=/  login-start  (on-poke.finished %manor-moon-action !>(`action:manor-moon`[%session 'test-1']))
=/  issued
  ;;([%pass wire=wire %arvo %i %request request=request:http config=outbound-config:iris] (snag 0 -.login-start))
?>  =('http://127.0.0.1:8101/~/login' url.request.issued)
=/  logged-in
  (on-arvo.login /http/2/login [%iris %http-response %finished [200 ~] `['text/plain' [3 '0v1']]])
=/  logged-in-app  +.logged-in
=/  after-login  !<(saved on-save.logged-in-app)
?>  =(~ pending.after-login)
?>  =(0 generation.after-login)
=/  first-card  (snag 0 -.logged-in)
?>  ?=([%give %fact *] first-card)
=/  payload  +.+.+.+.first-card
=/  answer  !<(reply:manor-moon payload)
?>  =('test-1' rid.answer)
?>  ?=([%session *] result.answer)
?>  =('urbauth-~pilfep-sicted-mignes-magtel=0v1' cookie.result.answer)
~|  %revoke-waits-for-confirmation
=/  revoke  +:(on-poke.logged-in-app %manor-moon-action !>(`action:manor-moon`[%revoke 'test-1']))
=/  logout
  +:(on-arvo.revoke /http/3/login [%iris %http-response %finished [200 ~] `['text/plain' [3 '0v1']]])
=/  logging-out  !<(saved on-save.logout)
?>  ?=([~ *] pending.logging-out)
?>  =(%logout stage.u.pending.logging-out)
?>  =(0 generation.logging-out)
=/  revoked
  +:(on-arvo.logout /http/3/logout [%iris %http-response %finished [303 ~] ~])
=/  released  !<(saved on-save.revoked)
?>  =(~ pending.released)
?>  =(1 generation.released)
~|  %failed-revocation-does-not-advance-generation
=/  not-cleared
  +:(on-poke.revoked %manor-moon-action !>(`action:manor-moon`[%configure %not-installed *(set desk)]))
=/  revoke-fail  +:(on-poke.not-cleared %manor-moon-action !>(`action:manor-moon`[%revoke 'test-1']))
=/  logout-fail
  +:(on-arvo.revoke-fail /http/4/login [%iris %http-response %finished [200 ~] `['text/plain' [3 '0v1']]])
=/  failed
  (on-arvo.logout-fail /http/4/logout [%iris %http-response %finished [303 ~] ~])
=/  failed-app  +.failed
=/  failed-state  !<(saved on-save.failed-app)
?>  =(1 generation.failed-state)
=/  first-fail  (snag 0 -.failed)
?>  ?=([%give %fact *] first-fail)
=/  fail-payload  +.+.+.+.first-fail
=/  failure  !<(reply:manor-moon fail-payload)
?>  ?=([%error *] result.failure)
~|  %missing-landing-does-not-log-in
=/  configured
  +:(on-poke.finished %manor-moon-action !>(`action:manor-moon`[%configure %not-installed *(set desk)]))
=/  refused  (on-poke.configured %manor-moon-action !>(`action:manor-moon`[%session 'test-1']))
?>  =(2 (lent -.refused))
=/  refused-app  +.refused
=/  unchanged  !<(saved on-save.refused-app)
?>  =(~ pending.unchanged)
~|  %re-pair-kicks-existing-watches
=/  local-paired  paired(+< b(src own))
=/  re-paired  (on-poke.local-paired %manor-moon-action !>(`action:manor-moon`[%pair `other]))
?>  =(1 (lent -.re-paired))
=/  kicked  (snag 0 -.re-paired)
?>  =([%give %kick ~[/result/test-1] ~] kicked)
0
