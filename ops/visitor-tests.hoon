::  Synthetic browser signals. No computed cards are delivered.
=/  own=ship  ~siglup-narwet
=/  who=ship  ~mapdex-fodtux-siglup-narwet
=/  b=bowl:gall
  %*(. *bowl:gall our own, src own, dap %manor, now ~2026.11.14)
=/  st=status:manor-ship
  [who `own 8.086 %glurff (silt `(list desk)`~[%glurff]) & | 0 ~]
=/  row=managed-ship:manor  [8.086 & `st ~ | ~ %manor ~]
=/  c=claim:manor  [now.b ~ ~ `now.b]
=/  key=@t  'fixture-proof'
=/  v=visitor:manor  [now.b (sham key) ~ ~ ~ 0 ~ ~ 0 ~]
=/  tab-body
  |=  tab=@t
  ^-  octs
  (as-octs:mimes:html (rap 3 ~[tab ':' (scot %uv (sham key))]))
=/  initial  *managed-pool:manor
=/  pool
  initial(ships (~(put by ships.initial) who row), claims (~(put by claims.initial) who c), visits (~(put by visits.initial) who v))
=/  target  ['http' 'localhost:8091']
=/  first=@t  '0123456789abcdef0123456789abcdef'
=/  second=@t  'abcdef0123456789abcdef0123456789'
=/  req=inbound-request:eyre
  [| | [%ipv4 .127.0.0.1] %'POST' '/~manor/visit/open' ~[['x-forwarded-host' 'mapdex-fodtux-siglup-narwet.localhost:8091'] ['origin' 'http://mapdex-fodtux-siglup-narwet.localhost:8091'] ['cookie' (cat 3 'manor-visit=' key)]] `(tab-body first)]
~|  %visitor-proof-origin-and-claim-are-all-required
?>  (visitor-valid:~(. manor-pool [b pool]) who req target &)
?<  (visitor-valid:~(. manor-pool [b pool]) who req(address [%ipv4 .192.0.2.1]) target &)
=/  no-proof  req(header-list.request ~[['x-forwarded-host' 'mapdex-fodtux-siglup-narwet.localhost:8091'] ['origin' 'http://mapdex-fodtux-siglup-narwet.localhost:8091']])
?<  (visitor-valid:~(. manor-pool [b pool]) who no-proof target &)
=/  wrong-origin  req(header-list.request ~[['x-forwarded-host' 'mapdex-fodtux-siglup-narwet.localhost:8091'] ['origin' 'http://attacker.localhost:8091'] ['cookie' (cat 3 'manor-visit=' key)]])
?<  (visitor-valid:~(. manor-pool [b pool]) who wrong-origin target &)
~|  %multiple-tabs-and-idle-time-do-not-free-a-ship
=/  one  +:(visitor-tab:~(. manor-pool [b pool]) who %open 'open1' req target)
?>  =(1 ~(wyt in tabs:(~(got by visits.one) who)))
?>  =(one +:(visitor-tab:~(. manor-pool [b one]) who %open 'duplicate' req target))
=/  two  +:(visitor-tab:~(. manor-pool [b one]) who %open 'open2' req(body.request `(tab-body second)) target)
=/  one-left  +:(visitor-tab:~(. manor-pool [b two]) who %close 'close1' req target)
?>  =(1 ~(wyt in tabs:(~(got by visits.one-left) who)))
?>  =(~ deadline:(~(got by visits.one-left) who))
?>  =(~ pending:(~(got by ships.one-left) who))
?>  =(one-left +:(close-visit:~(. manor-pool [b(now (add now.b ~d1)) one-left]) who (sham key) 2))
~|  %last-tab-close-starts-grace-and-refresh-cancels-it
=/  closing  +:(visitor-tab:~(. manor-pool [b one-left]) who %close 'close2' req(body.request `(tab-body second)) target)
=/  v  (~(got by visits.closing) who)
?>  =(`(add now.b ~s30) deadline.v)
?>  =(closing +:(close-visit:~(. manor-pool [b closing]) who proof.v revision.v))
?>  =(closing +:(visitor-tab:~(. manor-pool [b closing]) who %close 'duplicate-close' req(body.request `(tab-body second)) target))
=/  third=@t  '11111111111111111111111111111111'
=/  reopened  +:(visitor-tab:~(. manor-pool [b closing]) who %open 'reopen' req(body.request `(tab-body third)) target)
?>  =(~ deadline:(~(got by visits.reopened) who))
?>  =(reopened +:(close-visit:~(. manor-pool [b(now (add now.b ~m1)) reopened]) who proof.v revision.v))
~|  %closed-documents-cannot-reopen-with-the-same-identity
?>  =(closing +:(visitor-tab:~(. manor-pool [b closing]) who %open 'late-open' req target))
~|  %close-before-open-cannot-resurrect-a-document
=/  close-first  +:(visitor-tab:~(. manor-pool [b pool]) who %close 'early-close' req target)
?>  =(close-first +:(visitor-tab:~(. manor-pool [b close-first]) who %open 'late-open' req target))
~|  %revocation-must-complete-before-a-claim-is-freed
=/  revoking  +:(close-visit:~(. manor-pool [b(now (add now.b ~m1)) closing]) who proof.v revision.v)
?>  (~(has by claims.revoking) who)
?>  =(~ visits.revoking)
?>  =(`'manor-1' pending:(~(got by ships.revoking) who))
=/  failed  +:(timeout:~(. manor-pool [b(now (add now.b ~m2)) revoking]) 'manor-1')
?>  (~(has by claims.failed) who)
?>  blocked:(~(got by ships.failed) who)
=/  confirmed  +:(receive:~(. manor-pool [b revoking]) /full-result/manor-1 [%fact [%noun !>(`reply:manor-ship`['manor-1' %revoked 2])]])
?<  (~(has by claims.confirmed) who)
~|  %old-close-timers-never-touch-a-new-claim
=/  new-claim=claim:manor  [(add now.b ~s1) ~ ~ `(add now.b ~s1)]
=/  changed  closing(claims (~(put by claims.closing) who new-claim))
=/  ignored  +:(close-visit:~(. manor-pool [b(now (add now.b ~m1)) changed]) who proof.v revision.v)
?>  =(new-claim (~(got by claims.ignored) who))
?>  =(~ pending:(~(got by ships.ignored) who))
~|  %old-documents-cannot-close-a-new-visit-with-replaced-cookies
=/  new-key=@t  'new-fixture-proof'
=/  new-visitor=visitor:manor  [at.new-claim (sham new-key) ~ ~ `(add now.b ~s30) revision.v ~ ~ 0 ~]
=/  reassigned  changed(visits (~(put by visits.changed) who new-visitor))
=/  stale  req(header-list.request ~[['x-forwarded-host' 'mapdex-fodtux-siglup-narwet.localhost:8091'] ['origin' 'http://mapdex-fodtux-siglup-narwet.localhost:8091'] ['cookie' (cat 3 'manor-visit=' new-key)]])
?>  (visitor-valid:~(. manor-pool [b reassigned]) who stale target &)
?>  =(reassigned +:(visitor-tab:~(. manor-pool [b reassigned]) who %close 'old-document' stale target))
?>  =(reassigned +:(close-visit:~(. manor-pool [b(now (add now.b ~m1)) reassigned]) who proof.v revision.v))
~|  %offline-ships-remain-quarantined-not-free
=/  offline  closing(ships (~(put by ships.closing) who row(online |)))
=/  held  +:(close-visit:~(. manor-pool [b(now (add now.b ~m1)) offline]) who proof.v revision.v)
?>  (~(has by claims.held) who)
?>  blocked:(~(got by ships.held) who)
~|  %manual-unlock-retires-visitor-proofs-and-cancels-grace
=/  manual  +:(unlock:~(. manor-pool [b closing]) who)
?>  =(~ visits.manual)
?>  (~(has by claims.manual) who)
0
