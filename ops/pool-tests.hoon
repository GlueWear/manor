::  Computed cards are inspected, never delivered to any ship or vane.
=/  own=ship  ~siglup-narwet
=/  moon=ship  ~pilfep-sicted-mignes-magtel
=/  b=bowl:gall
  %*(. *bowl:gall our own, src own, dap %manor, now ~2026.11.12, eny `@uvJ`123)
=/  initial  *full-pool:manor
=/  fc  ~(. manor-full [b initial])
~|  %new-moon-requires-unlock
=/  registered  (register:fc moon)
=/  fp  +.registered
=/  row  (~(got by moons.fp) moon)
?>  blocked.row
?<  online.row
?>  =(1 (lent -.registered))
~|  %status-validates-controller-and-port
=/  status=status:manor-moon
  [moon `own 8.101 %glurff (silt `(list desk)`~[%glurff %noltbook]) & | 0 ~]
=/  fc  ~(. manor-full [b fp])
=/  checked
  (receive:fc /full-status/(scot %p moon) [%fact [%noun !>(status)]])
=/  fp  +.checked
=/  row  (~(got by moons.fp) moon)
?>  online.row
?>  =(8.101 port.row)
?<  (available:~(. manor-full [b fp]) row)
=/  wrong=status:manor-moon  status(controller `~zod)
=/  refused
  (receive:~(. manor-full [b fp]) /full-status/(scot %p moon) [%fact [%noun !>(wrong)]])
=/  offline  +.refused
?<  online:(~(got by moons.offline) moon)
=/  changed-port=status:manor-moon  status(port 8.102)
=/  refused-port
  (receive:~(. manor-full [b fp]) /full-status/(scot %p moon) [%fact [%noun !>(changed-port)]])
=/  offline-port  +.refused-port
?<  online:(~(got by moons.offline-port) moon)
~|  %unlock-only-frees-after-confirmation
=/  started  (unlock:~(. manor-full [b fp]) moon)
=/  fp  +.started
?>  =(3 (lent -.started))
=/  row  (~(got by moons.fp) moon)
?>  blocked.row
?>  =(`'manor-1' pending.row)
=/  cleared
  (receive:~(. manor-full [b fp]) /full-result/manor-1 [%fact [%noun !>(`reply:manor-moon`['manor-1' %revoked 1])]])
=/  fp  +.cleared
=/  row  (~(got by moons.fp) moon)
?<  blocked.row
?>  =(~ pending.row)
?>  (available:~(. manor-full [b fp]) row)
~|  %loopback-guard
=/  req=inbound-request:eyre
  [| | [%ipv4 .127.0.0.1] %'GET' '/apps/manor/public/full/assign' ~[['x-forwarded-host' 'join.localhost:8091']] ~]
?>  (local-trial:fc req)
?<  (local-trial:fc req(address [%ipv4 .192.0.2.1]))
?<  (local-trial:fc req(request [%'GET' '/' ~[['x-forwarded-host' 'join.glurff.com']] ~]))
~|  %assign-and-consume-one-time-ticket
=/  assigned  (assign:~(. manor-full [b fp]) 'http1' req)
=/  fp  +.assigned
=/  claim  (~(got by claims.fp) moon)
?>  ?=(^ ticket.claim)
=/  ticket=@t  (scot %uv (sham eny.b [%'http1' serial.fp]))
=/  moon-req
  req(request [%'GET' '/~manor/enter' ~[['x-forwarded-host' 'pilfep-sicted-mignes-magtel.localhost:8091']] ~])
=/  entered
  (enter:~(. manor-full [b fp]) 'http2' moon-req moon `ticket)
=/  active  +.entered
=/  claim  (~(got by claims.active) moon)
?>  =(~ ticket.claim)
?>  =(~ expires.claim)
?>  (~(has by requests.active) 'manor-2')
=/  repeated
  (enter:~(. manor-full [b active]) 'http3' moon-req moon `ticket)
?>  =(active +.repeated)
~|  %session-keeps-rich-state-and-no-cookie
=/  success
  (receive:~(. manor-full [b active]) /full-result/manor-2 [%fact [%noun !>(`reply:manor-moon`['manor-2' %session 'urbauth-~pilfep-sicted-mignes-magtel=0v1'])]])
=/  used  +.success
=/  claim  (~(got by claims.used) moon)
?>  =(`now.b entered.claim)
?>  =(~ requests.used)
?>  =(~ pending:(~(got by moons.used) moon))
~|  %failed-unlock-retains-claim
=/  releasing  +:(unlock:~(. manor-full [b used]) moon)
=/  failed
  +:(receive:~(. manor-full [b releasing]) /full-result/manor-3 [%fact [%noun !>(`reply:manor-moon`['manor-3' %error 'fixture failure'])]])
?>  (~(has by claims.failed) moon)
?>  blocked:(~(got by moons.failed) moon)
=/  failed-row  (~(got by moons.failed) moon)
?>  ?=(^ fault.failed-row)
~|  %late-reply-does-not-free-a-new-claim
=/  late
  +:(receive:~(. manor-full [b failed]) /full-result/manor-3 [%fact [%noun !>(`reply:manor-moon`['manor-3' %revoked 2])]])
?>  =(failed late)
~|  %controller-reload-quarantines-interrupted-work
=/  restarted  +:resume:~(. manor-full [b releasing])
?>  (~(has by claims.restarted) moon)
?>  blocked:(~(got by moons.restarted) moon)
?<  online:(~(got by moons.restarted) moon)
?>  =(~ requests.restarted)
~|  %timeout-is-not-success
=/  timed
  +:(timeout:~(. manor-full [b(now (add now.b ~m1)) releasing]) 'manor-3')
?>  (~(has by claims.timed) moon)
?>  blocked:(~(got by moons.timed) moon)
~|  %remove-refuses-live-claim
?>  =(~ (mole |.((remove:~(. manor-full [b used]) moon))))
0
