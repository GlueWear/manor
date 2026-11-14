::  %manor: visitor pools for Theseus and independent Urbit ships.
::
/-  manor-moon, manor-ship
|%
::  a visitor's hold on a moon: the one-time ticket's hash and when it
::  runs out, until they arrive (.entered)
::
+$  claim
  $:  at=@da
      ticket=(unit @uvH)
      expires=(unit @da)
      entered=(unit @da)
  ==
::  .base: the public address moons hang off, e.g. 203-0-113-7.nip.io,
::  giving join.<base> and <moon>.<base>.  .landing: where a visitor
::  arrives on their moon, e.g. /apps/glurff/
::
+$  settings  [base=@t landing=@t]
::  from the admin page
::
+$  action
  $%  [%connect fleet=@tas snapshot=path]   ::  pool = a Theseus fleet
      [%reset ships=(list ship)]            ::  restore, then free
      [%release ships=(list ship)]          ::  free as they are
      [%remove ships=(list ship)]           ::  out of the pool
      [%settings =settings]
      [%hosting base=@t landing=@t pool=?(%ships %theseus)]
      [%full-add who=ship]
      [%full-remove who=ship]
      [%full-unlock who=ship]
      [%ship-add who=ship endpoint=(unit endpoint)]
      [%ship-approve who=ship endpoint=(unit endpoint)]
      [%ship-reject who=ship]
      [%ship-reconnect who=ship]
      [%ship-upgrade who=ship]
      [%ship-remove who=ship]
      [%ship-forget who=ship]
      [%ship-unlock who=ship]
      [%ship-profile who=ship name=(unit (unit @t)) avatar=(unit (unit @t))]
      [%ship-configure who=ship landing=desk required=(set desk)]
      [%pair controller=(unit ship)]
      [%managed-configure landing=desk required=(set desk)]
  ==
::  Full moons are a separate, local-only trial. Never store credentials.
+$  full-moon
  $:  port=@ud
      online=?
      status=(unit status:manor-moon)
      pending=(unit @ta)
      blocked=?
      fault=(unit @t)
  ==
+$  full-request
  $:  who=ship
      op=?(%session %revoke)
      eyre=(unit @ta)
      claim-at=@da
      deadline=@da
  ==
+$  full-pool
  $:  moons=(map ship full-moon)
      claims=(map ship claim)
      requests=(map @ta full-request)
      serial=@ud
  ==
::  Explicit endpoint is reachable from Caddy: HTTPS, or a loopback tunnel.
+$  endpoint  [host=@t port=@ud secure=?]
+$  managed-ship
  $:  port=@ud
      online=?
      status=(unit status:manor-ship)
      pending=(unit @ta)
      blocked=?
      fault=(unit @t)
      transport=?(%manor %manor-moon)
      endpoint=(unit endpoint)
  ==
+$  managed-request-5
  $:  who=ship
      op=?(%session %revoke %profile)
      eyre=(unit @ta)
      claim-at=@da
      deadline=@da
  ==
+$  managed-request
  $:  who=ship
      op=?(%session %revoke %profile)
      eyre=(unit @ta)
      claim-at=@da
      deadline=@da
      secure=?
  ==
+$  managed-pool-4
  $:  ships=(map ship managed-ship)
      claims=(map ship claim)
      requests=(map @ta managed-request-5)
      serial=@ud
  ==
+$  managed-pool-5
  $:  ships=(map ship managed-ship)
      claims=(map ship claim)
      requests=(map @ta managed-request-5)
      serial=@ud
      apps=(map ship (list installed-app:manor-ship))
  ==
+$  managed-pool
  $:  ships=(map ship managed-ship)
      claims=(map ship claim)
      requests=(map @ta managed-request)
      serial=@ud
      apps=(map ship (list installed-app:manor-ship))
  ==
++  migrate-requests
  |=  old=(map @ta managed-request-5)
  ^-  (map @ta managed-request)
  (~(run by old) |=(r=managed-request-5 [who.r op.r eyre.r claim-at.r deadline.r |]))
++  migrate-managed
  |=  old=managed-pool-4
  ^-  managed-pool
  [ships.old claims.old (migrate-requests requests.old) serial.old ~]
++  migrate-managed-5
  |=  old=managed-pool-5
  ^-  managed-pool
  [ships.old claims.old (migrate-requests requests.old) serial.old apps.old]
::  Preserve active legacy connections until their operator switches agents.
++  migrate-pool
  |=  old=full-pool
  ^-  managed-pool
  :*  %-  malt
      %+  turn  ~(tap by moons.old)
      |=  [who=ship row=full-moon]
      [who port.row online.row status.row pending.row blocked.row fault.row %manor-moon ~]
      claims.old
      (migrate-requests requests.old)
      serial.old
      ~
  ==
::  %theseus's restore request ($recycle in its /sur/theseus)
::
+$  recycle  [who=ship path=path]
::  a visitor's session on a moon, from %theseus: watch /session/<rid>,
::  then poke %theseus-session; the one fact is the moon's login cookie,
::  urbauth-~moon=<session>, or why not ($session-* in /sur/theseus)
::
+$  session-request  [rid=@ta who=ship]
+$  session-result   (each @t @t)
--
