=/  own=ship  ~siglup-narwet
=/  moon=ship  ~pilfep-sicted-mignes-magtel
=/  old-moon=ship  ~sampel-siglup-narwet
=/  b=bowl:gall
  %*(. *bowl:gall our own, src own, dap %manor, now ~2026.11.12)
=/  fresh  ~(. ctor b)
=/  saved
  $:  %2
      pool=(map ship path)
      fleet=(unit [name=@tas snapshot=path])
      claims=(map ship claim:manor)
      =settings:manor
      log=(list [at=@da text=@t])
      front=(unit @da)
      full=full-pool:manor
  ==
=/  pool=(map ship path)  (~(put by *(map ship path)) old-moon /clean)
=/  claims=(map ship claim:manor)
  (~(put by *(map ship claim:manor)) old-moon [now.b ~ ~ `now.b])
=/  settings=settings:manor  ['glurff.com' '/apps/glurff/']
~|  %state-one-migration-preserves-public-pool
=/  legacy
  !>([%1 pool `[%hosting /clean] claims settings `(list [@da @t])`~[[now.b 'Original log']] `now.b])
=/  loaded  (on-load.fresh legacy)
=/  app  +.loaded
=/  current  !<(saved on-save.app)
?>  =(pool pool.current)
?>  =(claims claims.current)
?>  =(settings settings.current)
?>  =(~ -.loaded)
?>  =(~ moons.full.current)
~|  %full-registration-never-replaces-theseus-pool
=/  registered  (on-poke.app %manor-action !>(`action:manor`[%full-add moon]))
=/  next  +.registered
=/  after  !<(saved on-save.next)
?>  =(pool pool.after)
?>  =(claims claims.after)
?>  (~(has by moons.full.after) moon)
~|  %state-two-reload-preserves-membership-and-reconnects
=/  reloaded  (on-load.next on-save.next)
=/  reloaded-app  +.reloaded
=/  reloaded-state  !<(saved on-save.reloaded-app)
?>  =(pool pool.reloaded-state)
?>  =(claims claims.reloaded-state)
?>  (~(has by moons.full.reloaded-state) moon)
?>  =(1 (lent -.reloaded))
~|  %owner-only-registration
=/  remote  app(+< b(src ~zod))
?>  =(~ (mole |.((on-poke.remote %manor-action !>(`action:manor`[%full-add moon])))))
~|  %state-zero-migration
=/  zero  !>([%0 pool `[%hosting /clean] claims settings *(list [@da @t])])
=/  zero-app  +:(on-load.fresh zero)
=/  zero-state  !<(saved on-save.zero-app)
?>  =(pool pool.zero-state)
?>  =(claims claims.zero-state)
?>  =(~ front.zero-state)
0
