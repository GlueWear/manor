::  Computed cards are inspected, never delivered to any ship or vane.
=/  own=ship  ~siglup-narwet
=/  moon=ship  ~pilfep-sicted-mignes-magtel
=/  b=bowl:gall
  %*(. *bowl:gall our own, src own, dap %manor, now ~2026.11.12, eny `@uvJ`123)
=/  initial  *managed-pool:manor
=/  fc  ~(. manor-pool [b initial])
=/  response-header
  |=  cards=(list card:agent:gall)
  ^-  response-header:http
  ?~  cards  !!
  =/  c  i.cards
  ?:  ?=([%give %fact * %http-response-header *] c)
    !<(response-header:http +.+.+.+.c)
  $(cards t.cards)
~|  %all-five-ship-classes
=/  names=(list ship)
  ~[~zod ~nolset ~mignes-magtel ~pilfep-sicted-mignes-magtel ~tacput-forlur-mopweb-docled--pilfep-sicted-mignes-magtel]
?>  %+  levy  names
    |=  who=ship
    =/  got  (mole |.((register:fc who ~)))
    ?=(^ got)
?>  =(~ (mole |.((register:fc own ~))))
~|  %endpoint-validation
?>  (valid-endpoint:fc ['127.0.0.1' 8.101 |])
?>  (valid-endpoint:fc ['remote.example' 443 &])
?<  (valid-endpoint:fc ['remote.example' 8.101 |])
?<  (valid-endpoint:fc ['remote.example/bad' 443 &])
?<  (valid-endpoint:fc ['remote.example' 0 &])
~|  %new-moon-requires-unlock
=/  registered  (register:fc moon ~)
=/  fp  +.registered
=/  row  (~(got by ships.fp) moon)
?>  blocked.row
?<  online.row
?>  =(2 (lent -.registered))
~|  %status-validates-controller-and-port
=/  status=status:manor-ship
  [moon `own 8.101 %glurff (silt `(list desk)`~[%glurff %noltbook]) & | 0 ~]
=/  fc  ~(. manor-pool [b fp])
=/  checked
  (receive:fc /full-status/(scot %p moon)/manor [%fact [%noun !>(status)]])
=/  fp  +.checked
=/  row  (~(got by ships.fp) moon)
?>  online.row
?>  =(8.101 port.row)
?<  (available:~(. manor-pool [b fp]) row)
=/  wrong=status:manor-ship  status(controller `~zod)
=/  refused
  (receive:~(. manor-pool [b fp]) /full-status/(scot %p moon)/manor [%fact [%noun !>(wrong)]])
=/  offline  +.refused
?<  online:(~(got by ships.offline) moon)
=/  changed-port=status:manor-ship  status(port 8.102)
=/  refused-port
  (receive:~(. manor-pool [b fp]) /full-status/(scot %p moon)/manor [%fact [%noun !>(changed-port)]])
=/  offline-port  +.refused-port
?<  online:(~(got by ships.offline-port) moon)
~|  %unlock-only-frees-after-confirmation
=/  started  (unlock:~(. manor-pool [b fp]) moon)
=/  fp  +.started
?>  =(3 (lent -.started))
=/  row  (~(got by ships.fp) moon)
?>  blocked.row
?>  =(`'manor-1' pending.row)
=/  cleared
  (receive:~(. manor-pool [b fp]) /full-result/manor-1 [%fact [%noun !>(`reply:manor-ship`['manor-1' %revoked 1])]])
=/  fp  +.cleared
=/  row  (~(got by ships.fp) moon)
?<  blocked.row
?>  =(~ pending.row)
?>  (available:~(. manor-pool [b fp]) row)
~|  %reload-and-reconnect-replace-surviving-gall-watches
=/  status-wire  /full-status/(scot %p moon)/manor
=/  subscribed  b(wex (~(put by wex.b) [status-wire moon %manor] [& /status]))
=/  expected=(list card:agent:gall)
  :~  [%pass status-wire %agent [moon %manor] %leave ~]
      [%pass status-wire %agent [moon %manor] %watch /status]
      [%pass /ship-apps/(scot %p moon) %agent [moon %manor] %watch /apps]
  ==
=/  reconnected  (reconnect:~(. manor-pool [subscribed fp]) moon)
?>  =(expected -.reconnected)
?>  =(claims.fp claims:+.reconnected)
?>  =(blocked.row blocked:(~(got by ships:+.reconnected) moon))
=/  restored  resume:~(. manor-pool [subscribed fp])
?>  =(expected -.restored)
?>  =(claims.fp claims:+.restored)
~|  %inventory-watches-also-survive-reload-without-duplicates
=/  both  subscribed(wex (~(put by wex.subscribed) [/ship-apps/(scot %p moon) moon %manor] [& /apps]))
=/  reset-apps  resume:~(. manor-pool [both fp])
?>  =(4 (lent -.reset-apps))
?>  =([%pass /ship-apps/(scot %p moon) %agent [moon %manor] %leave ~] (snag 2 -.reset-apps))
?>  =([%pass /ship-apps/(scot %p moon) %agent [moon %manor] %watch /apps] (snag 3 -.reset-apps))
?<  online:(~(got by ships:+.restored) moon)
=/  fresh
  +:(receive:~(. manor-pool [subscribed +.restored]) status-wire [%fact [%noun !>(status)]])
?>  online:(~(got by ships.fresh) moon)
?>  (available:~(. manor-pool [subscribed fresh]) (~(got by ships.fresh) moon))
~|  %missing-watch-is-opened-without-a-spurious-leave
=/  new-watch  (reconnect:~(. manor-pool [b fp]) moon)
?>  =((weld ~[(watch-moon:~(. manor-pool [b fp]) moon)] (apps-watch:~(. manor-pool [b fp]) moon &)) -.new-watch)
~|  %installed-app-feed-is-separate-from-visitor-status
=/  catalog=(list installed-app:manor-ship)  ~[[%glurff & &] [%noltbook-data | |]]
=/  catalogued
  +:(receive:~(. manor-pool [b fp]) /ship-apps/(scot %p moon) [%fact [%noun !>(catalog)]])
?>  =(catalog (~(got by apps.catalogued) moon))
?>  =(ships.fp ships.catalogued)
?>  =(claims.fp claims.catalogued)
=/  removed-catalog  +:(forget:~(. manor-pool [b catalogued]) moon)
?<  (~(has by apps.removed-catalog) moon)
?>  =(removed-catalog +:(receive:~(. manor-pool [b removed-catalog]) /ship-apps/(scot %p moon) [%fact [%noun !>(catalog)]]))
=/  forgotten-apps  (forget:~(. manor-pool [both catalogued]) moon)
?>  =(2 (lent -.forgotten-apps))
?>  =([%pass /ship-apps/(scot %p moon) %agent [moon %manor] %leave ~] (snag 1 -.forgotten-apps))
~|  %loopback-guard
=/  req=inbound-request:eyre
  [| | [%ipv4 .127.0.0.1] %'GET' '/apps/manor/public/full/assign' ~[['x-forwarded-host' 'join.localhost:8091']] ~]
?>  (local-trial:fc req)
?<  (local-trial:fc req(address [%ipv4 .192.0.2.1]))
?<  (local-trial:fc req(request [%'GET' '/' ~[['x-forwarded-host' 'join.glurff.com']] ~]))
~|  %public-origin-requires-loopback-and-the-exact-configured-authority
=/  pub  req(request [%'GET' '/apps/manor/public/managed/assign' ~[['x-forwarded-host' 'join.glurff.com']] ~])
?>  =(`['https' 'glurff.com'] (origin:fc pub 'glurff.com'))
?>  =(~ (origin:fc pub ''))
?>  =(~ (origin:fc pub(address [%ipv4 .192.0.2.1]) 'glurff.com'))
?>  =(~ (origin:fc pub(request [%'GET' '/' ~[['x-forwarded-host' 'join.glurff.com.attacker.test']] ~]) 'glurff.com'))
=/  wrong-join  pub(request [%'GET' '/' ~[['x-forwarded-host' 'other.glurff.com']] ~])
?>  =(fp +:(assign-at:~(. manor-pool [b fp]) 'bad-public' wrong-join ['https' 'glurff.com']))
~|  %public-login-keeps-tickets-single-use-and-sets-a-secure-host-cookie
=/  public-assigned  (assign-at:~(. manor-pool [b fp]) 'pub1' pub ['https' 'glurff.com'])
=/  public-pool  +.public-assigned
=/  public-ticket  (scot %uv (sham eny.b [%'pub1' serial.fp]))
=/  public-header  (response-header -.public-assigned)
?>  =(`(cat 3 'https://pilfep-sicted-mignes-magtel.glurff.com/~manor/enter?ticket=' public-ticket) (get-header:http 'location' +.public-header))
=/  public-ship  pub(request [%'GET' '/~manor/enter' ~[['x-forwarded-host' 'pilfep-sicted-mignes-magtel.glurff.com']] ~])
=/  public-entered  (enter-at:~(. manor-pool [b public-pool]) 'pub2' public-ship moon `public-ticket ['https' 'glurff.com'])
=/  public-active  +.public-entered
?>  secure:(~(got by requests.public-active) 'manor-2')
?>  =(public-active +:(enter-at:~(. manor-pool [b public-active]) 'pub3' public-ship moon `public-ticket ['https' 'glurff.com']))
=/  public-success
  (receive:~(. manor-pool [b public-active]) /full-result/manor-2 [%fact [%noun !>(`reply:manor-ship`['manor-2' %session 'urbauth-~pilfep-sicted-mignes-magtel=0v1'])]])
?>  (~(has by claims:+.public-success) moon)
?>  =(~ requests:+.public-success)
=/  public-header  (response-header -.public-success)
?>  =(`'urbauth-~pilfep-sicted-mignes-magtel=0v1; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure' (get-header:http 'set-cookie' +.public-header))
?>  =(`'/apps/glurff/' (get-header:http 'location' +.public-header))
~|  %old-request-migration-defaults-to-nonsecure-local-preview
=/  old-request=managed-request-5:manor  [moon %session `'fixture-http' now.b (add now.b ~s45)]
=/  converted  (migrate-requests:manor (~(put by *(map @ta managed-request-5:manor)) 'old' old-request))
?<  secure:(~(got by converted) 'old')
~|  %assign-and-consume-one-time-ticket
=/  assigned  (assign:~(. manor-pool [b fp]) 'http1' req)
=/  fp  +.assigned
=/  claim  (~(got by claims.fp) moon)
?>  ?=(^ ticket.claim)
=/  ticket=@t  (scot %uv (sham eny.b [%'http1' serial.fp]))
=/  moon-req
  req(request [%'GET' '/~manor/enter' ~[['x-forwarded-host' 'pilfep-sicted-mignes-magtel.localhost:8091']] ~])
=/  entered
  (enter:~(. manor-pool [b fp]) 'http2' moon-req moon `ticket)
=/  active  +.entered
=/  claim  (~(got by claims.active) moon)
?>  =(~ ticket.claim)
?>  =(~ expires.claim)
?>  (~(has by requests.active) 'manor-2')
=/  repeated
  (enter:~(. manor-pool [b active]) 'http3' moon-req moon `ticket)
?>  =(active +.repeated)
~|  %session-keeps-rich-state-and-no-cookie
=/  success
  (receive:~(. manor-pool [b active]) /full-result/manor-2 [%fact [%noun !>(`reply:manor-ship`['manor-2' %session 'urbauth-~pilfep-sicted-mignes-magtel=0v1'])]])
=/  used  +.success
=/  local-header  (response-header -.success)
?>  =(`'urbauth-~pilfep-sicted-mignes-magtel=0v1; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax' (get-header:http 'set-cookie' +.local-header))
=/  claim  (~(got by claims.used) moon)
?>  =(`now.b entered.claim)
?>  =(~ requests.used)
?>  =(~ pending:(~(got by ships.used) moon))
~|  %successful-login-arms-first-page-registration-grace
=/  first-page  (~(got by visits.used) moon)
?>  =(`(add now.b ~m4) deadline.first-page)
?>  =(~ seen.first-page)
?>  =([%pass (visit-wire:~(. manor-pool [b used]) moon first-page) %arvo %b %wait (add now.b ~m4)] (snag 2 -.success))
~|  %status-refresh-never-frees-an-active-visitor
=/  reconnected-used  (reconnect:~(. manor-pool [subscribed used]) moon)
?>  =(expected -.reconnected-used)
?>  =(claims.used claims:+.reconnected-used)
=/  reloaded-used  resume:~(. manor-pool [subscribed used])
?>  =(expected -.reloaded-used)
?>  =(claims.used claims:+.reloaded-used)
?>  =(blocked:(~(got by ships.used) moon) blocked:(~(got by ships:+.reloaded-used) moon))
~|  %failed-unlock-retains-claim
=/  releasing  +:(unlock:~(. manor-pool [b used]) moon)
=/  failed
  +:(receive:~(. manor-pool [b releasing]) /full-result/manor-3 [%fact [%noun !>(`reply:manor-ship`['manor-3' %error 'fixture failure'])]])
?>  (~(has by claims.failed) moon)
?>  blocked:(~(got by ships.failed) moon)
=/  failed-row  (~(got by ships.failed) moon)
?>  ?=(^ fault.failed-row)
~|  %late-reply-does-not-free-a-new-claim
=/  late
  +:(receive:~(. manor-pool [b failed]) /full-result/manor-3 [%fact [%noun !>(`reply:manor-ship`['manor-3' %revoked 2])]])
?>  =(failed late)
~|  %controller-reload-quarantines-interrupted-work
=/  restarted  +:resume:~(. manor-pool [b releasing])
?>  (~(has by claims.restarted) moon)
?>  blocked:(~(got by ships.restarted) moon)
?<  online:(~(got by ships.restarted) moon)
?>  =(~ requests.restarted)
~|  %timeout-is-not-success
=/  timed
  +:(timeout:~(. manor-pool [b(now (add now.b ~m1)) releasing]) 'manor-3')
?>  (~(has by claims.timed) moon)
?>  blocked:(~(got by ships.timed) moon)
~|  %remove-refuses-live-claim
?>  =(~ (mole |.((remove:~(. manor-pool [b used]) moon))))
~|  %forget-does-not-need-remote-unlock
=/  another  +:(register:~(. manor-pool [b active]) ~nolset ~)
=/  another-claim=claim:manor  [now.b ~ ~ `now.b]
=/  another-request=managed-request:manor  [~nolset %profile ~ now.b (add now.b ~s45) |]
=/  pending-pool
  another(claims (~(put by claims.another) ~nolset another-claim), requests (~(put by requests.another) 'other-1' another-request))
?>  =(~ (mole |.((remove:~(. manor-pool [b pending-pool]) moon))))
=/  forgotten  (forget:~(. manor-pool [b pending-pool]) moon)
=/  remaining  +.forgotten
?<  (~(has by ships.remaining) moon)
?<  (~(has by claims.remaining) moon)
?<  (~(has by requests.remaining) 'manor-2')
?>  (~(has by ships.remaining) ~nolset)
?>  =(another-claim (~(got by claims.remaining) ~nolset))
?>  =(another-request (~(got by requests.remaining) 'other-1'))
?>  =(serial.pending-pool serial.remaining)
=/  forgetting  ~(. manor-pool [b pending-pool])
=/  expected=(list card:agent:gall)
  ~[[%pass /full-status/(scot %p moon)/manor %agent [moon %manor] %leave ~]]
=/  req  (~(got by requests.pending-pool) 'manor-2')
=/  expected
  (weld expected (weld (cleanup:forgetting 'manor-2' req) (answer:forgetting 'http2' 503 'This ship was removed from Manor.')))
?>  =(expected -.forgotten)
?>  =(remaining +:(forget:~(. manor-pool [b remaining]) moon))
?>  =(remaining +:(receive:~(. manor-pool [b remaining]) /full-result/manor-2 [%fact [%noun !>(`reply:manor-ship`['manor-2' %revoked 2])]]))
?>  =(remaining +:(receive:~(. manor-pool [b remaining]) /full-status/(scot %p moon)/manor [%fact [%noun !>(status)]]))
?>  =(remaining +:(timeout:~(. manor-pool [b(now (add now.b ~m1)) remaining]) 'manor-2'))
~|  %forget-also-retires-a-legacy-status-watch
=/  old-row  (~(got by ships.used) moon)
=/  legacy  used(ships (~(put by ships.used) moon old-row(transport %manor-moon)))
=/  old-wire  /full-status/(scot %p moon)
=/  subscribed  b(wex (~(put by wex.b) [old-wire moon %manor-moon] [& /status]))
=/  forgotten-legacy  (forget:~(. manor-pool [subscribed legacy]) moon)
?>  =(3 (lent -.forgotten-legacy))
?>  =([%pass (visit-wire:~(. manor-pool [b used]) moon first-page) %arvo %b %rest (add now.b ~m4)] (snag 0 -.forgotten-legacy))
?>  =([%pass old-wire %agent [moon %manor-moon] %leave ~] (snag 2 -.forgotten-legacy))
?>  =(~ claims:+.forgotten-legacy)
~|  %profile-result-keeps-claim-and-completes-async-work
=/  updating  +:(profile:~(. manor-pool [b used]) moon ``'Pilot' ~)
?>  =(~ pending:(~(got by ships.updating) moon))
?>  (available:~(. manor-pool [b updating]) (~(got by ships.updating) moon))
=/  updated
  +:(receive:~(. manor-pool [b updating]) /full-result/manor-3 [%fact [%noun !>(`reply:manor-ship`['manor-3' %profile ~])]])
?>  (~(has by claims.updated) moon)
?>  =(~ requests.updated)
~|  %profile-confirmation-reconciles-stale-busy-status
=/  busy-row  (~(got by ships.updating) moon)
=/  stale  updating(ships (~(put by ships.updating) moon busy-row(status `status(busy &))))
=/  confirmed-profile
  +:(receive:~(. manor-pool [b stale]) /full-result/manor-3 [%fact [%noun !>(`reply:manor-ship`['manor-3' %profile-status status])]])
?>  (available:~(. manor-pool [b confirmed-profile]) (~(got by ships.confirmed-profile) moon))
?>  (~(has by claims.confirmed-profile) moon)
~|  %successful-profile-retry-clears-its-old-error
=/  old-error  updating(ships (~(put by ships.updating) moon busy-row(fault `'The profile update timed out.')))
=/  retried-profile
  +:(receive:~(. manor-pool [b old-error]) /full-result/manor-3 [%fact [%noun !>(`reply:manor-ship`['manor-3' %profile-status status])]])
?>  =(~ fault:(~(got by ships.retried-profile) moon))
~|  %profile-retry-never-clears-an-authentication-failure
=/  blocked  old-error(ships (~(put by ships.old-error) moon busy-row(blocked &, fault `'Login failed.')))
=/  still-blocked
  +:(receive:~(. manor-pool [b blocked]) /full-result/manor-3 [%fact [%noun !>(`reply:manor-ship`['manor-3' %profile-status status])]])
?>  blocked:(~(got by ships.still-blocked) moon)
?>  =(`'Login failed.' fault:(~(got by ships.still-blocked) moon))
~|  %profile-completion-cannot-clear-a-concurrent-unlock
=/  unlocking  +:(unlock:~(. manor-pool [b updating]) moon)
=/  concurrent
  +:(receive:~(. manor-pool [b unlocking]) /full-result/manor-3 [%fact [%noun !>(`reply:manor-ship`['manor-3' %profile-status status(busy &)])]])
?>  =(`'manor-4' pending:(~(got by ships.concurrent) moon))
?>  (~(has by claims.concurrent) moon)
?>  (~(has by requests.concurrent) 'manor-4')
~|  %remote-ships-may-share-their-own-web-port
=/  first
  +:(register:fc ~zod `['one.example' 443 &])
=/  second
  +:(register:~(. manor-pool [b first]) ~nolset `['two.example' 443 &])
=/  zs=status:manor-ship  [~zod `own 8.101 %landscape *(set desk) & | 0 ~]
=/  ns=status:manor-ship  zs(who ~nolset)
=/  first-online
  +:(receive:~(. manor-pool [b second]) /full-status/~zod/manor [%fact [%noun !>(zs)]])
=/  both-online
  +:(receive:~(. manor-pool [b first-online]) /full-status/~nolset/manor [%fact [%noun !>(ns)]])
?>  online:(~(got by ships.both-online) ~zod)
?>  online:(~(got by ships.both-online) ~nolset)
0
