::  Pure control-component tests. No computed cards are delivered.
=/  own=ship  ~pilfep-sicted-mignes-magtel
=/  king=ship  ~siglup-narwet
=/  b=bowl:gall
  %*(. *bowl:gall our own, src own, dap %manor, now ~2026.11.13)
=/  local  initial:manor-ship
=/  c  ~(. control [b local])
~|  %generic-defaults
?>  =(initial:manor-ship bootstrap.c)
?>  =(%landscape landing.local)
?>  =(1 ~(wyt in required.local))
?>  =(~ watches.c)
?>  =(~ announce.c)
?>  =(~ (mole |.((watch:~(. control [b(src king) local]) /apps))))
~|  %pair-is-local-only
?>  =(~ (mole |.((act.c [%pair `own]))))
=/  stranger  ~(. control [b(src king) local])
?>  =(~ (mole |.((act.stranger [%pair `king]))))
=/  paired  (act.c [%pair `king])
=/  local  +.paired
?>  =(`king controller.local)
?>  ?=(^ (mole |.((watch:~(. control [b(src king) local]) /apps))))
~|  %pairing-announces-without-exposing-status-or-login
=/  c  ~(. control [b local])
=/  notice  [%pass /ship-pair-request %agent [king %manor] %poke %manor-pair-request !>(~)]
?>  =(~[notice] announce.c)
?>  (lien -.paired |=(c=card:agent:gall =(notice c)))
?>  (lien -:resume.c |=(c=card:agent:gall =(notice c)))
?<  (lien watches.c |=(c=card:agent:gall =(notice c)))
?>  =(~ announce:~(. control [b +:(act.c [%pair ~])]))
~|  %controller-can-configure-not-repair
=/  c  ~(. control [b(src king) local])
?>  =(~ (mole |.((act.c [%pair `~zod]))))
=/  configured  (act.c [%configure %glurff (silt `(list desk)`~[%glurff])])
=/  local  +.configured
?>  =(%glurff landing.local)
~|  %pairing-preserves-admin-watchers
=/  sb  b(sup (~(put by *(map duct [ship path])) `duct`~[/admin] [own /state]))
=/  sb  sb(sup (~(put by sup.sb) `duct`~[/managed] [king /result/test-1]))
=/  re-paired  (act:~(. control [sb local]) [%pair `king])
=/  first  (snag 0 -.re-paired)
?>  =([%give %kick ~[/result/test-1] ~] first)
~|  %remote-status-permissions
?>  ?=(^ (mole |.((watch:~(. control [b(src king) local]) /status))))
?>  =(~ (mole |.((watch:~(. control [b(src ~zod) local]) /status))))
~|  %session-then-revoke
=/  b  b(src king, sup (~(put by sup.b) ~ [king /result/test-1]))
=/  started  (act:~(. control [b local]) [%session 'test-1'])
=/  local  +.started
?>  ?=(^ pending.local)
=/  replied
  (arvo:~(. control [b local]) /ship-http/1/login [%iris %http-response %finished [200 ~] `['text/plain' [3 '0v1']]])
=/  local  +.replied
?>  =(~ pending.local)
=/  result-card  (snag 0 -.replied)
?>  ?=([%give %fact *] result-card)
=/  issued  !<(reply:manor-ship +.+.+.+.result-card)
?>  ?=([%session *] result.issued)
?>  =('urbauth-~pilfep-sicted-mignes-magtel=0v1' cookie.result.issued)
=/  revoking  +:(act:~(. control [b local]) [%revoke 'test-1'])
=/  logging-out
  +:(arvo:~(. control [b revoking]) /ship-http/2/login [%iris %http-response %finished [200 ~] `['text/plain' [3 '0v1']]])
?>  =(0 generation.logging-out)
=/  revoked
  +:(arvo:~(. control [b logging-out]) /ship-http/2/logout [%iris %http-response %finished [303 ~] ~])
?>  =(1 generation.revoked)
?>  =(~ pending.revoked)
~|  %profile-uses-local-api-only
=/  profile  (act:~(. control [b revoked]) [%profile 'test-1' ``'Pilot' ``'https://example.com/picture.png'])
=/  first  (snag 0 -.profile)
?>  ?=([%pass * %agent * %poke-as %noltbook-api *] first)
?>  =(~ pending:+.profile)
=/  profile-status  snapshot:~(. control [b +.profile])
?<  busy.profile-status
~|  %profile-confirmation-includes-authoritative-status
=/  wire  -.+.first
=/  replied  (agent:~(. control [b +.profile]) wire [%poke-ack ~])
=/  fact  (snag 0 -.replied)
?>  ?=([%give %fact *] fact)
=/  reply  !<(reply:manor-ship +.+.+.+.fact)
?>  ?=([* %profile-status *] reply)
?<  busy.snapshot.result.reply
~|  %reload-fails-in-flight-work-without-freeing-any-pool
=/  restored  resume:~(. control [b +.profile])
?>  =(~ pending:+.restored)
0
