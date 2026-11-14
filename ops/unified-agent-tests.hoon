=/  own=ship  ~siglup-narwet
=/  managed=ship  ~pilfep-sicted-mignes-magtel
=/  virtual=ship  ~sampel-siglup-narwet
=/  b=bowl:gall
  %*(. *bowl:gall our own, src own, dap %manor, now ~2026.11.13)
=/  app  ~(. ctor b)
=/  tls-status
  |=  [a=agent:gall domain=@t]
  ^-  @ud
  =/  req=inbound-request:eyre
    [| | [%ipv4 .127.0.0.1] %'GET' (cat 3 '/apps/manor/public/tls-ask?domain=' domain) ~ ~]
  =/  cards  -:(on-poke.a %handle-http-request !>([~.tls-test req]))
  |-  ^-  @ud
  ?~  cards  !!
  =/  c  i.cards
  ?:  ?=([%give %fact * %http-response-header *] c)
    -:!<(response-header:http +.+.+.+.c)
  $(cards t.cards)
=/  saved
  $:  %8
      pool=(map ship path)
      fleet=(unit [name=@tas snapshot=path])
      claims=(map ship claim:manor)
      =settings:manor
      log=(list [at=@da text=@t])
      front=(unit @da)
      full=managed-pool:manor
      controlled=local-state:manor-ship
      pair-requests=(map ship @da)
      visitor-pool=?(%ships %theseus)
  ==
=/  pool=(map ship path)  (~(put by *(map ship path)) virtual /clean)
=/  claims=(map ship claim:manor)
  (~(put by *(map ship claim:manor)) virtual [now.b ~ ~ `now.b])
=/  settings=settings:manor  ['glurff.com' '/apps/glurff/']
~|  %state-zero-keeps-public-pool
=/  old  !>([%0 pool `[%hosting /clean] claims settings *(list [@da @t])])
=/  loaded-zero  +:(on-load.app old)
=/  state  !<(saved on-save.loaded-zero)
?>  =(pool pool.state)
?>  =(claims claims.state)
?>  =(~ pair-requests.state)
~|  %state-one-keeps-public-pool
=/  old  !>([%1 pool `[%hosting /clean] claims settings *(list [@da @t]) `now.b])
=/  loaded  +:(on-load.app old)
=/  state  !<(saved on-save.loaded)
?>  =(pool pool.state)
?>  =(claims claims.state)
?>  =(~ ships.full.state)
~|  %state-two-keeps-legacy-connection-and-claims
=/  old-full=full-pool:manor
  [(~(put by *(map ship full-moon:manor)) managed [8.101 & ~ ~ | ~]) claims *(map @ta full-request:manor) 7]
=/  old  !>([%2 pool `[%hosting /clean] claims settings *(list [@da @t]) `now.b old-full])
=/  old-wire  /full-status/(scot %p managed)
=/  subscribed  app(+< b(wex (~(put by wex.b) [old-wire managed %manor-moon] [& /status])))
=/  migrated  (on-load.subscribed old)
?>  =([%pass old-wire %agent [managed %manor-moon] %leave ~] (snag 0 -.migrated))
=/  loaded  +:(on-load.app old)
=/  state  !<(saved on-save.loaded)
=/  row  (~(got by ships.full.state) managed)
?>  =(%manor-moon transport.row)
?>  =(8.101 port.row)
?>  =(7 serial.full.state)
?>  =(claims claims.full.state)
~|  %generic-registration-is-independent-of-theseus
=/  registered  +:(on-poke.loaded %manor-action !>(`action:manor`[%ship-add ~nolset ~]))
=/  state  !<(saved on-save.registered)
?>  (~(has by ships.full.state) ~nolset)
?>  =(pool pool.state)
?>  =(claims claims.state)
~|  %pairing-notice-is-not-authorization
=/  asking  registered(+< b(src ~zod))
=/  requested  +:(on-poke.asking %manor-pair-request !>(~))
=/  state  !<(saved on-save.requested)
?>  (~(has by pair-requests.state) ~zod)
?<  (~(has by ships.full.state) ~zod)
?>  =(pool pool.state)
?>  =(claims claims.state)
~|  %duplicate-notices-do-not-change-state
=/  repeated  +:(on-poke.requested %manor-pair-request !>(~))
?>  =(on-save.requested on-save.repeated)
~|  %registered-and-self-notices-are-ignored
=/  ignored  +:(on-poke.registered %manor-pair-request !>(~))
?>  =(on-save.registered on-save.ignored)
=/  known  registered(+< b(src ~nolset))
=/  known-notice  (on-poke.known %manor-pair-request !>(~))
=/  ignored  +.known-notice
?>  =(on-save.known on-save.ignored)
?>  =(2 (lent -.known-notice))
?>  =([%pass /ship-apps/~nolset %agent [~nolset %manor] %watch /apps] (snag 1 -.known-notice))
~|  %foreign-peer-cannot-approve-itself
?>  =(~ (mole |.((on-poke.requested %manor-action !>(`action:manor`[%ship-approve ~zod ~])))))
~|  %owner-approves-a-blocked-registration
=/  owner  requested(+< b)
?>  =(~ (mole |.((on-poke.owner %manor-action !>(`action:manor`[%ship-approve ~zod `['remote.example/bad' 443 &]])))))
=/  approved  +:(on-poke.owner %manor-action !>(`action:manor`[%ship-approve ~zod ~]))
=/  state  !<(saved on-save.approved)
?<  (~(has by pair-requests.state) ~zod)
?>  (~(has by ships.full.state) ~zod)
?>  blocked:(~(got by ships.full.state) ~zod)
~|  %owner-can-reject-and-manually-register
=/  rejected  +:(on-poke.owner %manor-action !>(`action:manor`[%ship-reject ~zod]))
=/  state  !<(saved on-save.rejected)
?<  (~(has by pair-requests.state) ~zod)
?<  (~(has by ships.full.state) ~zod)
=/  added  +:(on-poke.owner %manor-action !>(`action:manor`[%ship-add ~zod ~]))
=/  state  !<(saved on-save.added)
?<  (~(has by pair-requests.state) ~zod)
=/  legacy-added  +:(on-poke.owner %manor-action !>(`action:manor`[%full-add ~zod]))
=/  state  !<(saved on-save.legacy-added)
?<  (~(has by pair-requests.state) ~zod)
~|  %pending-requests-are-bounded
=/  notices=(map ship @da)
  %-  malt
  %+  turn  (gulf 0 63)
  |=  i=@ud
  [(add 256 i) now.b]
=/  full-state  state(pair-requests notices)
=/  full-agent  +:(on-load.registered !>(full-state))
=/  stranger  full-agent(+< b(src ~mignes-magtel))
=/  unchanged  +:(on-poke.stranger %manor-pair-request !>(~))
=/  state  !<(saved on-save.unchanged)
?>  =(64 ~(wyt by pair-requests.state))
?<  (~(has by pair-requests.state) ~mignes-magtel)
~|  %state-three-migration-keeps-managed-and-public-claims
=/  old-managed=managed-pool-4:manor
  [ships.full.state claims.full.state *(map @ta managed-request-5:manor) serial.full.state]
=/  old-three  !>([%3 pool.state fleet.state claims.state settings.state log.state front.state old-managed controlled.state])
=/  migrated-three  +:(on-load.registered old-three)
=/  migrated-state  !<(saved on-save.migrated-three)
?>  =(pool.state pool.migrated-state)
?>  =(claims.state claims.migrated-state)
?>  =(claims.full.state claims.full.migrated-state)
?>  =(~ pair-requests.migrated-state)
~|  %state-four-migration-keeps-pending-pair-requests
=/  old-four  !>([%4 pool.state fleet.state claims.state settings.state log.state front.state old-managed controlled.state pair-requests.state])
=/  migrated-four  +:(on-load.registered old-four)
=/  migrated-state  !<(saved on-save.migrated-four)
?>  =(pair-requests.state pair-requests.migrated-state)
?>  =(~ apps.full.migrated-state)
~|  %state-five-upgrade-does-not-publish-managed-ships-implicitly
=/  old-five=managed-pool-5:manor
  [ships.full.state claims.full.state *(map @ta managed-request-5:manor) serial.full.state apps.full.state]
=/  old  !>([%5 pool.state fleet.state claims.state settings.state log.state front.state old-five controlled.state pair-requests.state])
=/  upgraded  +:(on-load.registered old)
=/  state  !<(saved on-save.upgraded)
?>  =(%theseus visitor-pool.state)
?>  =(claims claims.state)
~|  %public-pool-selection-is-an-owner-only-setting
=/  configured-host  +:(on-poke.upgraded %manor-action !>(`action:manor`[%hosting 'glurff.com' '/apps/glurff/' %ships]))
=/  state  !<(saved on-save.configured-host)
?>  =(%ships visitor-pool.state)
?>  =('glurff.com' base.settings.state)
?>  =(claims claims.state)
~|  %state-six-keeps-public-selection-without-tracking-existing-visitors
=/  prior-full=managed-pool-6:manor
  [ships.full.state claims.full.state requests.full.state serial.full.state apps.full.state]
=/  old-six  !>([%6 pool.state fleet.state claims.state settings.state log.state front.state prior-full controlled.state pair-requests.state visitor-pool.state])
=/  from-six  +:(on-load.configured-host old-six)
=/  reloaded-state  !<(saved on-save.from-six)
?>  =(%ships visitor-pool.reloaded-state)
?>  =(claims.full.state claims.full.reloaded-state)
?>  =(~ visits.full.reloaded-state)
~|  %public-certificates-only-cover-the-selected-pool
?>  =(200 (tls-status configured-host 'join.glurff.com'))
?>  =(200 (tls-status configured-host 'nolset.glurff.com'))
?>  =(403 (tls-status configured-host 'siglup-narwet.glurff.com'))
?>  =(403 (tls-status configured-host 'nec.glurff.com'))
?>  =(403 (tls-status configured-host 'nolset.glurff.com.attacker.test'))
?>  =(403 (tls-status upgraded 'nolset.glurff.com'))
~|  %same-agent-can-also-be-controlled
~|  %dojo-pair-generator-delivery
=/  system  [now.b 0 [own %base %da now.b]]
=/  gate  +.pair-gen
=/  generated  (gate [system [~zod ~] ~])
?>  =(%manor-ship-action -.generated)
=/  paired  +:(on-poke.registered -.generated !>(+.generated))
=/  state  !<(saved on-save.paired)
?>  =(`~zod controller.controlled.state)
?>  (~(has by ships.full.state) ~nolset)
~|  %dojo-configure-generator-delivery
=/  gate  +.configure-gen
=/  generated  (gate [system [%glurff ~] ~])
=/  configured-owner  +:(on-poke.paired -.generated !>(+.generated))
=/  state  !<(saved on-save.configured-owner)
?>  =(%glurff landing.controlled.state)
?>  =(1 ~(wyt in required.controlled.state))
~|  %dojo-report-generator-delivery
=/  gate  +.report-gen
=/  generated  (gate [system ~ ~])
=/  reported  (on-poke.configured-owner -.generated !>(+.generated))
?>  =(1 (lent -.reported))
~|  %dojo-unpair-generator-delivery
=/  gate  +.unpair-gen
=/  generated  (gate [system ~ ~])
=/  unpaired  +:(on-poke.configured-owner -.generated !>(+.generated))
=/  state  !<(saved on-save.unpaired)
?>  =(~ controller.controlled.state)
~|  %paired-peer-cannot-administer-controller-pool
=/  peer  paired(+< b(src ~zod))
?>  =(~ (mole |.((on-poke.peer %manor-action !>(`action:manor`[%ship-remove ~nolset])))))
?>  =(~ (mole |.((on-poke.peer %manor-action !>(`action:manor`[%ship-forget ~nolset])))))
?>  =(~ (mole |.((on-poke.peer %manor-action !>(`action:manor`[%ship-approve ~nolset ~])))))
?>  =(~ (mole |.((on-poke.peer %manor-action !>(`action:manor`[%ship-reject ~nolset])))))
?>  =(~ (mole |.((on-poke.peer %manor-action !>(`action:manor`[%hosting 'attacker.test' '/apps/glurff/' %ships])))))
?>  =(~ (mole |.((on-watch.peer /state))))
?>  =(~ (mole |.((on-peek.peer /x/state))))
?>  ?=(^ (mole |.((on-watch.peer /status))))
~|  %paired-peer-can-configure-only-local-role
=/  configured
  +:(on-poke.peer %manor-ship-action !>(`action:manor-ship`[%configure %glurff (silt `(list desk)`~[%glurff])]))
=/  state  !<(saved on-save.configured)
?>  =(%glurff landing.controlled.state)
?>  =(pool pool.state)
?>  (~(has by ships.full.state) ~nolset)
~|  %state-seven-reload-keeps-both-roles
=/  reloaded  +:(on-load.paired on-save.paired)
=/  state  !<(saved on-save.reloaded)
?>  =(`~zod controller.controlled.state)
?>  (~(has by ships.full.state) ~nolset)
~|  %state-seven-reload-preserves-tab-membership-and-close-deadlines
=/  held-claim=claim:manor  [now.b ~ ~ `now.b]
=/  visit=visitor:manor  [now.b (sham 'fixture-proof') ~ ~ `(add now.b ~s30) 3 ~ ~ 0 ~]
=/  next-full  full.state(claims (~(put by claims.full.state) ~nolset held-claim), visits (~(put by visits.full.state) ~nolset visit))
=/  restored  +:(on-load.reloaded !>(state(full next-full)))
=/  next  !<(saved on-save.restored)
?>  =(visits.next-full visits.full.next)
?>  =(held-claim (~(got by claims.full.next) ~nolset))
~|  %state-seven-migration-retains-close-tracking-but-starts-with-idle-disabled
=/  legacy-visit=visitor-7:manor  [now.b (sham 'fixture-proof') (silt `(list @ta)`~[~.tab-one]) (silt `(list @ta)`~[~.tab-one]) ~ 4]
=/  legacy-full=managed-pool-7:manor
  [ships.next-full claims.next-full requests.next-full serial.next-full apps.next-full (~(put by *(map ship visitor-7:manor)) ~nolset legacy-visit)]
=/  legacy  !>([%7 pool.state fleet.state claims.state settings.state log.state front.state legacy-full controlled.state pair-requests.state visitor-pool.state])
=/  upgraded  +:(on-load.restored legacy)
=/  next  !<(saved on-save.upgraded)
=/  visit  (~(got by visits.full.next) ~nolset)
?>  =(0 idle-minutes.full.next)
?>  =(tabs.legacy-visit tabs.visit)
?>  =(~ idle-tabs.visit)
?>  =(~ idle-at.visit)
~|  %only-the-owner-can-enable-idle-eviction
?>  =(~ (mole |.((on-poke.peer %manor-action !>(`action:manor`[%idle-policy 15])))))
?>  =(~ (mole |.((on-poke.upgraded %manor-action !>(`action:manor`[%idle-policy 1])))))
=/  enabled  +:(on-poke.upgraded %manor-action !>(`action:manor`[%idle-policy 15]))
?>  =(15 idle-minutes.full:!<(saved on-save.enabled))
0
