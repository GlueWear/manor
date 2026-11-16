::  %manor: hand this ship's Theseus moons to visitors, and reset them
::
::    The pool is a connected Theseus fleet: its moons, and the snapshot
::    each one goes back to.  Claims say which visitor has which moon.
::    Everything else lives in %theseus: moon codes, readiness, the
::    restores that reset a moon, and the sessions that log visitors in.
::    Managed ships use the same agent and a separate pool. The owner
::    explicitly selects which pool serves public visitors.
::
::    The public side is reached only through Caddy, at /apps/manor/public:
::    the lever page and /assign on join.<base>, /enter on a moon's own
::    address (Caddy maps <moon>.<base>/~manor/enter there), and Caddy's
::    certificate check, /tls-ask.  Everything else is for the owner.
::
/-  manor, manor-ship
/+  default-agent, dbug, server, manor-pool, control=manor-ship
|%
+$  state-0
  $:  %0
      pool=(map ship path)
      fleet=(unit [name=@tas snapshot=path])
      claims=(map ship claim:manor)
      =settings:manor
      log=(list [at=@da text=@t])
  ==
::  %1: .front, the last visit through the front door (Caddy)
::
+$  state-1
  $:  %1
      pool=(map ship path)
      fleet=(unit [name=@tas snapshot=path])
      claims=(map ship claim:manor)
      =settings:manor
      log=(list [at=@da text=@t])
      front=(unit @da)
  ==
+$  state-2
  $:  %2
      pool=(map ship path)
      fleet=(unit [name=@tas snapshot=path])
      claims=(map ship claim:manor)
      =settings:manor
      log=(list [at=@da text=@t])
      front=(unit @da)
      full=full-pool:manor
  ==
+$  state-3
  $:  %3
      pool=(map ship path)
      fleet=(unit [name=@tas snapshot=path])
      claims=(map ship claim:manor)
      =settings:manor
      log=(list [at=@da text=@t])
      front=(unit @da)
      full=managed-pool-4:manor
      controlled=local-state:manor-ship
  ==
+$  state-4
  $:  %4
      pool=(map ship path)
      fleet=(unit [name=@tas snapshot=path])
      claims=(map ship claim:manor)
      =settings:manor
      log=(list [at=@da text=@t])
      front=(unit @da)
      full=managed-pool-4:manor
      controlled=local-state:manor-ship
      pair-requests=(map ship @da)
  ==
+$  state-5
  $:  %5
      pool=(map ship path)
      fleet=(unit [name=@tas snapshot=path])
      claims=(map ship claim:manor)
      =settings:manor
      log=(list [at=@da text=@t])
      front=(unit @da)
      full=managed-pool-5:manor
      controlled=local-state:manor-ship
      pair-requests=(map ship @da)
  ==
+$  state-6
  $:  %6
      pool=(map ship path)
      fleet=(unit [name=@tas snapshot=path])
      claims=(map ship claim:manor)
      =settings:manor
      log=(list [at=@da text=@t])
      front=(unit @da)
      full=managed-pool-6:manor
      controlled=local-state:manor-ship
      pair-requests=(map ship @da)
      visitor-pool=?(%ships %theseus)
  ==
+$  state-7
  $:  %7
      pool=(map ship path)
      fleet=(unit [name=@tas snapshot=path])
      claims=(map ship claim:manor)
      =settings:manor
      log=(list [at=@da text=@t])
      front=(unit @da)
      full=managed-pool-7:manor
      controlled=local-state:manor-ship
      pair-requests=(map ship @da)
      visitor-pool=?(%ships %theseus)
  ==
+$  state-8
  $:  %8
      pool=(map ship path)
      fleet=(unit [name=@tas snapshot=path])
      claims=(map ship claim:manor)
      =settings:manor
      log=(list [at=@da text=@t])
      front=(unit @da)
      full=managed-pool-8:manor
      controlled=local-state:manor-ship
      pair-requests=(map ship @da)
      visitor-pool=?(%ships %theseus)
  ==
+$  state-9
  $:  %9
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
+$  versioned-state  $%(state-0 state-1 state-2 state-3 state-4 state-5 state-6 state-7 state-8 state-9)
+$  card  card:agent:gall
::  how long a one-time link to a moon works
::
++  ticket-life  ~m2
--
=|  state-9
=*  state  -
=<
%-  agent:dbug
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
    hc    ~(. +> bowl)
::
++  on-init
  ^-  (quip card _this)
  =/  setup  bootstrap:~(. control [bowl initial:manor-ship])
  :_  this(landing.settings '/apps/landscape/', controlled setup, visitor-pool %ships)
  [[%pass /bind %arvo %e %connect `/apps/manor %manor] (weld watches:~(. control [bowl setup]) announce:~(. control [bowl setup]))]
::
++  on-save  !>(state)
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  =/  got  !<(versioned-state old)
  =/  fallback=local-state:manor-ship
    ?:  |(=(%3 -.got) =(%4 -.got) =(%5 -.got) =(%6 -.got) =(%7 -.got) =(%8 -.got) =(%9 -.got))  initial:manor-ship
    bootstrap:~(. control [bowl initial:manor-ship])
  =/  loaded=state-9
    ?-  -.got
      %9  got
      %8  [%9 pool.got fleet.got claims.got settings.got log.got front.got (migrate-managed-8:manor full.got) controlled.got pair-requests.got visitor-pool.got]
      %7  [%9 pool.got fleet.got claims.got settings.got log.got front.got (migrate-managed-7:manor full.got) controlled.got pair-requests.got visitor-pool.got]
      %6  [%9 pool.got fleet.got claims.got settings.got log.got front.got (migrate-managed-6:manor full.got) controlled.got pair-requests.got visitor-pool.got]
      %5  [%9 pool.got fleet.got claims.got settings.got log.got front.got (migrate-managed-5:manor full.got) controlled.got pair-requests.got %theseus]
      %4  [%9 pool.got fleet.got claims.got settings.got log.got front.got (migrate-managed:manor full.got) controlled.got pair-requests.got %theseus]
      %3  [%9 pool.got fleet.got claims.got settings.got log.got front.got (migrate-managed:manor full.got) controlled.got ~ %theseus]
      %2  [%9 pool.got fleet.got claims.got settings.got log.got front.got (migrate-pool:manor full.got) fallback ~ %theseus]
      %1  [%9 pool.got fleet.got claims.got settings.got log.got front.got *managed-pool:manor fallback ~ %theseus]
      %0  [%9 pool.got fleet.got claims.got settings.got log.got ~ *managed-pool:manor fallback ~ %theseus]
    ==
  =/  resumed  resume:~(. manor-pool [bowl full.loaded])
  =/  local  resume:~(. control [bowl controlled.loaded])
  [(weld -.resumed -.local) this(state loaded(full +.resumed, controlled +.local))]
::
::  Any change to the pool, claims, settings or activity is told to the
::  admin page (/state), which then reads it again: no timer.
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  =/  old  state
  =^  cards  state
    ?+    mark  ~|([%manor-bad-mark mark] !!)
        %manor-action
      ?>  =(src.bowl our.bowl)
      (act:hc !<(action:manor vase))
    ::
        %manor-ship-action
      =^  cards  controlled  (act:~(. control [bowl controlled]) !<(action:manor-ship vase))
      [cards state]
    ::
        %manor-pair-request
      ?>  =(~ !<(~ vase))
      (pair-request:hc src.bowl)
    ::
        %handle-http-request
      =/  req  !<([id=@ta req=inbound-request:eyre] vase)
      ?:  (public-path:hc url.request.req.req)
        (public:hc id.req req.req)
      [(give-simple-payload:app:server id.req (serve:hc req.req)) state]
    ==
  ::  Connection renewals must not make every admin page fetch the whole pool.
  [?:(=(old(pulses.full ~) state(pulses.full ~)) cards (snoc cards state-signal:hc)) this]
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
    ::  Eyre watches as the requester's identity, guests included
    [%http-response @ ~]  `this
    ::  "something changed": the owner's admin page
    [%state ~]  ?>(=(src.bowl our.bowl) `this)
    [%status ~]    [(watch:~(. control [bowl controlled]) path) this]
    [%apps ~]      [(watch:~(. control [bowl controlled]) path) this]
    [%result @ ~]  [(watch:~(. control [bowl controlled]) path) this]
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  (on-peek:def path)
    [%x %state ~]  ?>(=(src.bowl our.bowl) ``json+!>(state-json:hc))
    [%x %status ~]
      ?>  authorized:~(. control [bowl controlled])
      ``noun+!>(snapshot:~(. control [bowl controlled]))
  ==
::
::  From %theseus: a reset's answer, and a visitor's session (+agent)
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  =/  old  state
  =^  cards  state  (agent:hc wire sign)
  [?:(|(!=(old state) ?=([%fact *] sign)) (snoc cards state-signal:hc) cards) this]
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  ?:  ?=([?(%ship-http %ship-timeout %ship-profile-timeout) *] wire)
    =^  cards  controlled  (arvo:~(. control [bowl controlled]) wire sign-arvo)
    [(snoc cards state-signal:hc) this]
  ?:  ?=([%full-timeout @ ~] wire)
    ?>  ?=([%behn %wake ~] sign-arvo)
    =^  cards  full  (timeout:~(. manor-pool [bowl full]) i.t.wire)
    [(snoc cards state-signal:hc) this]
  ?:  ?=([%visit-close @ @ @ ~] wire)
    ?>  ?=([%behn %wake ~] sign-arvo)
    =^  cards  full
      (close-visit:~(. manor-pool [bowl full]) (slav %p i.t.wire) `@uvH`(slav %uv i.t.t.wire) (slav %ud i.t.t.t.wire))
    [(snoc cards state-signal:hc) this]
  ?:  ?=([%visit-idle @ @ @ ~] wire)
    ?>  ?=([%behn %wake ~] sign-arvo)
    =^  cards  full
      (idle-expire:~(. manor-pool [bowl full]) (slav %p i.t.wire) `@uvH`(slav %uv i.t.t.wire) (slav %ud i.t.t.t.wire))
    [(snoc cards state-signal:hc) this]
  ?:  ?=([%visit-pulse @ @ @ ~] wire)
    ?>  ?=([%behn %wake ~] sign-arvo)
    =/  old  state
    =^  cards  full
      (expire-pulses:~(. manor-pool [bowl full]) (slav %p i.t.wire) `@uvH`(slav %uv i.t.t.wire) (slav %ud i.t.t.t.wire))
    [?:(=(old(pulses.full ~) state(pulses.full ~)) cards (snoc cards state-signal:hc)) this]
  ?:  ?=([%release-retry @ @ ~] wire)
    ?>  ?=([%behn %wake ~] sign-arvo)
    =/  old  state
    =^  cards  full
      (retry-release:~(. manor-pool [bowl full]) (slav %p i.t.wire) (slav %da i.t.t.wire))
    [?:(=(old(releases.full ~) state(releases.full ~)) cards (snoc cards state-signal:hc)) this]
  ?:  ?=([%bind ~] wire)  `this
  (on-arvo:def wire sign-arvo)
::
++  on-leave
  |=  =path
  ^-  (quip card _this)
  ?.  ?=([%http-response @ ~] path)  (on-leave:def path)
  =.  full  (visitor-unwatch:~(. manor-pool [bowl full]) i.t.path)
  `this
++  on-fail   on-fail:def
--
|_  =bowl:gall
::
::  An authenticated peer can request a connection, never grant itself one.
++  pair-request
  |=  who=ship
  ^-  (quip card _state)
  ?:  |(=(who our.bowl) (gth (met 0 who) 128))  `state
  ?:  (~(has by ships.full) who)
    =/  fc  ~(. manor-pool [bowl full])
    [(weld (refresh-watch:fc who) (apps-watch:fc who &)) state]
  ?:  (~(has by pair-requests) who)  `state
  ?:  (gte ~(wyt by pair-requests) 64)  `state
  `state(pair-requests (~(put by pair-requests) who now.bowl))
::
::  +act: an admin action from the page
::
++  act
  |=  =action:manor
  ^-  (quip card _state)
  ?-    -.action
      %full-add
    ?>  !(~(has by pool) who.action)
    =^  cards  full  (register:~(. manor-pool [bowl full]) who.action ~)
    [cards state(pair-requests (~(del by pair-requests) who.action), log (add-log 'Managed ship registered for local testing.'))]
  ::
      %full-remove
    =^  cards  full  (remove:~(. manor-pool [bowl full]) who.action)
    [cards state(log (add-log 'Managed ship removed from the local pool.'))]
  ::
      %full-unlock
    =^  cards  full  (unlock:~(. manor-pool [bowl full]) who.action)
    [cards state(log (add-log 'Requested managed-ship session revocation.'))]
  ::
      %ship-add
    ?>  !(~(has by pool) who.action)
    =^  cards  full  (register:~(. manor-pool [bowl full]) who.action endpoint.action)
    [cards state(pair-requests (~(del by pair-requests) who.action), log (add-log 'Managed ship registered.'))]
      %ship-approve
    ?>  (~(has by pair-requests) who.action)
    ?>  !(~(has by pool) who.action)
    =^  cards  full  (register:~(. manor-pool [bowl full]) who.action endpoint.action)
    [cards state(pair-requests (~(del by pair-requests) who.action), log (add-log 'Approved ship connection. Unlock it before sharing.'))]
      %ship-reject
    `state(pair-requests (~(del by pair-requests) who.action))
      %ship-reconnect
    =^  cards  full  (reconnect:~(. manor-pool [bowl full]) who.action)
    [cards state]
      %ship-upgrade
    =/  row  (~(got by ships.full) who.action)
    =^  cards  full  (register:~(. manor-pool [bowl full]) who.action endpoint.row)
    [cards state(log (add-log 'Switched managed ship to the unified Manor agent.'))]
      %ship-remove
    =^  cards  full  (remove:~(. manor-pool [bowl full]) who.action)
    [cards state(log (add-log 'Removed managed ship.'))]
      %ship-forget
    =^  cards  full  (forget:~(. manor-pool [bowl full]) who.action)
    [cards state(pair-requests (~(del by pair-requests) who.action), log (add-log 'Forgot ship registration and reservation; remote sessions were not revoked.'))]
      %ship-unlock
    =^  cards  full  (unlock:~(. manor-pool [bowl full]) who.action)
    [cards state(log (add-log 'Requested managed-ship session revocation.'))]
      %idle-policy
    =^  cards  full  (set-idle:~(. manor-pool [bowl full]) minutes.action)
    [cards state(log (add-log 'Visitor idle policy updated.'))]
      %ship-profile
    =^  cards  full  (profile:~(. manor-pool [bowl full]) who.action name.action avatar.action)
    [cards state(log (add-log 'Requested managed-ship profile update.'))]
      %ship-configure
    =^  cards  full  (configure:~(. manor-pool [bowl full]) who.action landing.action required.action)
    [cards state(log (add-log 'Requested managed-ship landing configuration.'))]
      %pair
    =^  cards  controlled  (act:~(. control [bowl controlled]) [%pair controller.action])
    [cards state]
      %managed-configure
    =^  cards  controlled  (act:~(. control [bowl controlled]) [%configure landing.action required.action])
    [cards state]
  ::
  ::  the pool becomes the fleet's moons, each reset from the snapshot,
  ::  which must hold all of them; claims on other moons are dropped
  ::
      %connect
    =/  ui  theseus-ui
    =/  members  (fleet-ships ui fleet.action)
    ?~  members  ~|([%manor-no-such-fleet fleet.action] !!)
    ?:  =(~ u.members)  ~|([%manor-empty-fleet fleet.action] !!)
    ?>  (levy u.members |=(s=ship !(~(has by ships.full) s)))
    =/  covered  (snapshot-ships ui snapshot.action)
    =/  missing  (skip u.members |=(s=ship (~(has in covered) s)))
    ?^  missing  ~|([%manor-snapshot-misses snapshot.action missing] !!)
    =/  new=(map ship path)
      (malt (turn u.members |=(s=ship [s snapshot.action])))
    =/  kept=(map ship claim:manor)
      %-  malt
      %+  skim  ~(tap by claims)
      |=([s=ship c=claim:manor] (~(has by new) s))
    :-  ~
    %=  state
      pool    new
      fleet   `[fleet.action snapshot.action]
      claims  kept
      log     (add-log (crip "Connected fleet {(trip fleet.action)}: {<(lent u.members)>} moons."))
    ==
  ::
  ::  each moon is restored by %theseus and free again at once: a moon
  ::  being restored is not ready, so it isn't handed out until it is
  ::
      %reset
    =/  hers  (in-pool ships.action)
    ?~  hers  `state
    :_  %=  state
          claims  (drop-claims hers)
          log     (add-log (crip "Resetting {(names hers)}."))
        ==
    %+  turn  `(list ship)`hers
    |=  who=ship
    ^-  card
    :*  %pass  /reset/(scot %p who)  %agent  [our.bowl %theseus]
        %poke  %theseus-recycle  !>(`recycle:manor`[who (~(got by pool) who)])
    ==
  ::
      %release
    =/  hers  (in-pool ships.action)
    ?~  hers  `state
    `state(claims (drop-claims hers), log (add-log (crip "Freed {(names hers)} as they are.")))
  ::
      %remove
    =/  hers  (in-pool ships.action)
    ?~  hers  `state
    =/  left=(map ship path)
      =/  todo  `(list ship)`hers
      =/  out  pool
      |-  ^+  out
      ?~  todo  out
      $(todo t.todo, out (~(del by out) i.todo))
    :-  ~
    %=  state
      pool    left
      fleet   ?~(left ~ fleet)
      claims  (drop-claims hers)
      log     (add-log (crip "Removed {(names hers)} from the pool."))
    ==
  ::
      %settings
    =*  new  settings.action
    ?>  (valid-base base.new)
    ?>  (valid-landing landing.new)
    `state(settings new, log (add-log 'Settings saved.'))
      %hosting
    ?>  (valid-base base.action)
    ?>  (valid-landing landing.action)
    `state(settings [base.action landing.action], visitor-pool pool.action, log (add-log 'Hosting settings saved.'))
  ==
::
::  the moons of .ships in the pool, in order
::
++  in-pool
  |=  ships=(list ship)
  ^-  (list ship)
  (skim ships |=(s=ship (~(has by pool) s)))
::
++  drop-claims
  |=  hers=(list ship)
  ^+  claims
  =/  out  claims
  |-  ^+  out
  ?~  hers  out
  $(hers t.hers, out (~(del by out) i.hers))
::
++  names
  |=  hers=(list ship)
  ^-  tape
  ?:  (gth (lent hers) 3)  "{<(lent hers)>} moons"
  =/  out=tape  ""
  |-  ^-  tape
  ?~  hers  out
  =/  next=tape  (scow %p i.hers)
  $(hers t.hers, out ?~(out next "{out}, {next}"))
::
::  the newest 50 entries
::
++  add-log
  |=  text=@t
  ^+  log
  (scag 50 `_log`[[now.bowl text] log])
::
::  a public address such as 203-0-113-7.nip.io, or none yet
::
++  valid-base
  |=  base=@t
  ^-  ?
  =/  t=tape  (trip base)
  ?&  (lte (lent t) 200)
      (levy t |=(c=@t |(&((gte c 'a') (lte c 'z')) &((gte c '0') (lte c '9')) =(c '-') =(c '.'))))
  ==
::
::  a path on the moon, such as /apps/glurff/
::
++  valid-landing
  |=  landing=@t
  ^-  ?
  =/  t=tape  (trip landing)
  ?&  =('/' (end 3 landing))
      (lte (lent t) 200)
      (levy t |=(c=@t &((gth c 32) (lth c 127))))
  ==
::
::  Theseus's view of this ship's moons, fleets and snapshots
::
++  theseus-ui
  ^-  json
  .^(json %gx /(scot %p our.bowl)/theseus/(scot %da now.bowl)/ui/json)
::
++  jo  |=(j=json ^-((map @t json) ?.(?=([%o *] j) ~ p.j)))
++  ja  |=(j=json ^-((list json) ?.(?=([%a *] j) ~ p.j)))
++  js  |=(j=json ^-(@t ?.(?=([%s *] j) '' p.j)))
::
++  json-ships
  |=  j=json
  ^-  (list ship)
  (murn (ja j) |=(s=json (slaw %p (js s))))
::
::  a fleet's members, or ~ if there is no such fleet
::
++  fleet-ships
  |=  [ui=json name=@tas]
  ^-  (unit (list ship))
  =/  rows  (ja (~(gut by (jo ui)) 'fleets' ~))
  |-  ^-  (unit (list ship))
  ?~  rows  ~
  =/  row  (jo i.rows)
  ?.  =(name (js (~(gut by row) 'name' ~)))  $(rows t.rows)
  `(json-ships (~(gut by row) 'ships' ~))
::
::  the moons a snapshot can reset: its own moon, or every moon in the set
::
++  snapshot-ships
  |=  [ui=json snap=path]
  ^-  (set ship)
  =/  want=@t  (spat snap)
  =/  rows  (ja (~(gut by (jo ui)) 'snapshots' ~))
  =|  out=(set ship)
  |-  ^-  (set ship)
  ?~  rows  out
  =/  row  (jo i.rows)
  =/  hit=?
    ?|  =(want (js (~(gut by row) 'path' ~)))
        =(want (js (~(gut by row) 'set' ~)))
    ==
  =?  out  hit  (~(gas in out) (json-ships (~(gut by row) 'ships' ~)))
  $(rows t.rows)
::
++  state-signal
  ^-  card
  [%give %fact ~[/state] %json !>(`json`b+&)]
::
::  +agent: %theseus's answers.  A reset's: only a refusal is news.  A
::  visitor's session: it answers their held /enter request.
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _state)
  ?:  ?=([?(%ship-kiln %ship-profile-updates %ship-profile %ship-pair-request) *] wire)
    =^  cards  controlled  (agent:~(. control [bowl controlled]) wire sign)
    [cards state]
  ?:  |(?=([%full-status *] wire) ?=([%ship-apps @ ~] wire) ?=([%full-result @ ~] wire) ?=([%full-ask @ ~] wire) ?=([%ship-configure @ ~] wire))
    =/  fc  ~(. manor-pool [bowl full])
    =/  work  (receive:fc wire sign)
    =/  cards=(list card:agent:gall)  -.work
    =/  next=managed-pool:manor  +.work
    [cards state(full next)]
  ?:  ?=([%reset @ ~] wire)
    ?.  ?=(%poke-ack -.sign)  `state
    ?~  p.sign  `state
    `state(log (add-log (rap 3 ~['Theseus refused to reset ' i.t.wire '. Its Dojo shows why.'])))
  ?:  ?=([%session @ @ ~] wire)
    =/  eyre-id=@ta  i.t.wire
    =/  who=ship  (slav %p i.t.t.wire)
    ?+  -.sign  `state
      %fact       (entered eyre-id who !<(session-result:manor q.cage.sign))
      %watch-ack  ?~(p.sign `state [(not-entered eyre-id) state])
    ==
  ::  the session request itself refused: the watch will hear nothing
  ?:  ?=([%ask @ @ ~] wire)
    ?.  ?=(%poke-ack -.sign)  `state
    ?~  p.sign  `state
    :_  state
    :-  [%pass /session/[i.t.wire]/[i.t.t.wire] %agent [our.bowl %theseus] %leave ~]
    (not-entered i.t.wire)
  `state
::
::  ---------------------------------------------------------------------
::  The public side, through Caddy
::
++  public-path
  |=  url=@t
  ^-  ?
  =('/apps/manor/public' (end [3 18] url))
::
++  public
  |=  [eyre-id=@ta req=inbound-request:eyre]
  ^-  (quip card _state)
  =.  front  `now.bowl
  =/  [pat=tape qs=tape]
    =/  t=tape  (trip url.request.req)
    =/  q  (find "?" t)
    ?~  q  [t ""]
    [(scag u.q t) (slag +(u.q) t)]
  =/  args=(list [key=@t value=@t])
    (fall (rush (crip qs) yquy:de-purl:html) ~)
  =/  give
    |=  =simple-payload:http
    ^-  (list card)
    (give-simple-payload:app:server eyre-id simple-payload)
  =/  visit-prefix  "/apps/manor/public/managed/visit/"
  ?:  =(visit-prefix (scag (lent visit-prefix) pat))
    =/  fc  ~(. manor-pool [bowl full])
    =/  target  (origin:fc req ?:(=(visitor-pool %ships) base.settings ''))
    ?~  target  [(give [[404 ~] ~]) state]
    =/  tail  (slag (lent visit-prefix) pat)
    =/  slash  (find "/" tail)
    =/  who  (slaw %p (crip ?~(slash tail (scag u.slash tail))))
    ?~  who  [(give [[404 ~] ~]) state]
    ?~  slash
      ?.  &((visitor-valid:fc u.who req u.target |) =(%'GET' method.request.req))
        [(give (page 410 'This visit has ended.' 'Return to the lever to get a ship.')) state]
      =/  payload  (file-payload /web/visit/html 'text/html; charset=utf-8')
      [(give [[200 ['content-type' 'text/html; charset=utf-8'] ['cache-control' 'no-store'] ['vary' 'Sec-Fetch-Dest, Cookie'] ~] +.payload]) state]
    =/  op  (crip (slag +(u.slash) tail))
    ?:  |(=('events' op) =('state' op))
      =^  cards  full
        (visitor-read:fc u.who =('events' op) eyre-id req u.target (get-header:http 'tab' args) (get-header:http 'visit' args))
      [cards state]
    ?.  |(=('open' op) =('close' op) =('activity' op))  [(give [[404 ~] ~]) state]
    =/  kind=?(%open %close %activity)
      ?:  =('open' op)  %open
      ?:(=('close' op) %close %activity)
    =^  cards  full  (visitor-tab:fc u.who kind eyre-id req u.target)
    [cards state]
  ?.  =('GET' method.request.req)  [(give [[405 ~] ~]) state]
  ?:  |(=("/apps/manor/public/full/" (scag 24 pat)) =("/apps/manor/public/managed/" (scag 27 pat)))
    =/  fc  ~(. manor-pool [bowl full])
    =/  origin  (origin:fc req ?:(=(visitor-pool %ships) base.settings ''))
    ?~  origin  [(give (page 404 'Nothing here.' 'This address is not available.')) state]
    ?:  |(=(pat "/apps/manor/public/full/assign") =(pat "/apps/manor/public/managed/assign"))
      =^  cards  full  (assign-at:fc eyre-id req u.origin)
      [cards state]
    =/  prefix
      ?:  =("/apps/manor/public/full/" (scag 24 pat))  "/apps/manor/public/full/enter/"
      "/apps/manor/public/managed/enter/"
    ?.  =(prefix (scag (lent prefix) pat))  [(give [[404 ~] ~]) state]
    =/  who  (slaw %p (crip (slag (lent prefix) pat)))
    ?~  who  [(give [[404 ~] ~]) state]
    =^  cards  full  (enter-at:fc eyre-id req u.who (get-header:http 'ticket' args) u.origin)
    [cards state]
  ?:  ?|  =(pat "/apps/manor/public")
          =(pat "/apps/manor/public/")
          =(pat "/apps/manor/public/gate/")
      ==
    [(give (file-payload /web/gate/html 'text/html')) state]
  ?:  =(pat "/apps/manor/public/trolley.png")
    [(give (file-payload /web/trolley/png 'image/png')) state]
  ?:  =(pat "/apps/manor/public/assign")
    ?.  =(%ships visitor-pool)  (assign eyre-id req)
    =/  fc  ~(. manor-pool [bowl full])
    =/  origin  (origin:fc req base.settings)
    ?~  origin  [(give [[403 ~] ~]) state]
    =^  cards  full  (assign-at:fc eyre-id req u.origin)
    [cards state]
  ?:  =(pat "/apps/manor/public/tls-ask")
    =/  ok  (allow-certificate (get-header:http 'domain' args))
    [(give [[?:(ok 200 403) ~] ~]) state]
  =/  enter-at  "/apps/manor/public/enter/"
  =/  nothing  (page 404 'Nothing here.' 'This address is not a page.')
  ?.  =(enter-at (scag (lent enter-at) pat))  [(give nothing) state]
  =/  who  (slaw %p (crip (slag (lent enter-at) pat)))
  ?~  who  [(give nothing) state]
  ?:  &(=(%ships visitor-pool) (~(has by ships.full) u.who))
    =/  fc  ~(. manor-pool [bowl full])
    =/  origin  (origin:fc req base.settings)
    ?~  origin  [(give [[403 ~] ~]) state]
    =^  cards  full  (enter-at:fc eyre-id req u.who (get-header:http 'ticket' args) u.origin)
    [cards state]
  (enter eyre-id req u.who (get-header:http 'ticket' args))
::
::  +assign: claim a free, ready moon for a visitor and send them to it
::  with a one-time ticket
::
++  assign
  |=  [eyre-id=@ta req=inbound-request:eyre]
  ^-  (quip card _state)
  =/  give
    |=  =simple-payload:http
    ^-  (list card)
    (give-simple-payload:app:server eyre-id simple-payload)
  =/  waiting  (page 503 'Moons are still getting ready.' 'Try again in a minute.')
  =/  ready  (mole |.(ready-moons))
  ?~  ready  [(give waiting) state]
  =.  claims  live-claims
  =/  open=(list ship)
    %+  skip  (sort ~(tap in ~(key by pool)) lth)
    |=(s=ship (~(has by claims) s))
  =/  pick  (skim open |=(s=ship (~(has in u.ready) s)))
  ?~  pick
    ?^  open  [(give waiting) state]
    [(give (page 503 'All moons are taken right now.' 'Check back soon.')) state]
  =/  base  (moon-base req)
  ?~  base
    [(give (page 503 'Manor is not open yet.' 'Its public address is not set.')) state]
  =/  who=ship  i.pick
  =/  ticket=@t  (scot %uv (sham eny.bowl eyre-id))
  =/  to=@t
    %+  rap  3
    :~  scheme.u.base  (rsh 3 (scot %p who))  '.'  host.u.base
        '/~manor/enter?ticket='  ticket
    ==
  =.  claims
    %+  ~(put by claims)  who
    [now.bowl `(sham ticket) `(add now.bowl ticket-life) ~]
  =.  log  (add-log (rap 3 ~['Gave ' (scot %p who) ' to a visitor.']))
  :_  state
  (give [[302 ['location' to] ['cache-control' 'no-store'] ~] ~])
::
::  +moon-base: where this visitor's moons live, <moon>.<host>: the public
::  address over HTTPS, or for Caddy's local test site, join.localhost:<port>,
::  http://<moon>.localhost:<port>.  Caddy sets X-Forwarded-Host.
::
++  moon-base
  |=  req=inbound-request:eyre
  ^-  (unit [scheme=@t host=@t])
  =/  fwd  (get-header:http 'x-forwarded-host' header-list.request.req)
  ?:  &(?=(^ fwd) =('join.localhost:' (end [3 15] u.fwd)))
    `['http://' (rsh [3 5] u.fwd)]
  ?:  =('' base.settings)  ~
  `['https://' base.settings]
::
::  +enter: log a visitor in to the moon their ticket is for
::
::    A valid ticket asks %theseus for a session on the moon; the request
::    is held until it answers (see +entered).  A visitor already holding
::    the moon's cookie goes straight to the landing page.
::
++  enter
  |=  [eyre-id=@ta req=inbound-request:eyre who=ship ticket=(unit @t)]
  ^-  (quip card _state)
  =/  give
    |=  =simple-payload:http
    ^-  (list card)
    (give-simple-payload:app:server eyre-id simple-payload)
  ?.  (~(has by pool) who)
    [(give (page 404 'Nothing here.' 'This moon is not handed out here.')) state]
  =/  claim  (~(get by claims) who)
  =/  valid=?
    ?~  claim  |
    ?~  ticket  |
    ?~  ticket.u.claim  |
    ?~  expires.u.claim  |
    &(=(u.ticket.u.claim (sham u.ticket)) (lth now.bowl u.expires.u.claim))
  ?.  valid
    ?:  (has-moon-cookie req who)  [(give (redirect landing.settings)) state]
    :_  state
    (give (page 403 'This link has already been used.' 'Pull the lever again to get a moon.'))
  :_  state
  :~  [%pass /session/[eyre-id]/(scot %p who) %agent [our.bowl %theseus] %watch /session/[eyre-id]]
      :*  %pass  /ask/[eyre-id]/(scot %p who)  %agent  [our.bowl %theseus]
          %poke  %theseus-session  !>(`session-request:manor`[eyre-id who])
      ==
  ==
::
::  +entered: %theseus's answer to a visitor's /enter
::
++  entered
  |=  [eyre-id=@ta who=ship got=session-result:manor]
  ^-  (quip card _state)
  ?:  ?=(%| -.got)
    :_  state(log (add-log (rap 3 ~['Could not log a visitor in to ' (scot %p who) ': ' p.got])))
    (not-entered eyre-id)
  =/  claim  (~(get by claims) who)
  ::  reset or freed while the visitor was on their way
  ?~  claim
    :_  state
    %+  give-simple-payload:app:server  eyre-id
    (page 409 'This moon was just reset.' 'Pull the lever again to get a moon.')
  :_  %=  state
        claims  (~(put by claims) who u.claim(ticket ~, expires ~, entered `now.bowl))
        log     (add-log (rap 3 ~['A visitor entered ' (scot %p who) '.']))
      ==
  %+  give-simple-payload:app:server  eyre-id
  :_  ~
  :-  303
  :~  ['set-cookie' (rap 3 ~[p.got '; Path=/; Max-Age=2592000'])]
      ['location' landing.settings]
      ['cache-control' 'no-store']
  ==
::
++  not-entered
  |=  eyre-id=@ta
  ^-  (list card)
  %+  give-simple-payload:app:server  eyre-id
  (page 502 'Your moon is not ready yet.' 'Try again in a minute.')
::
::  claims still holding a moon: dropped once a ticket ran out unused
::
++  live-claims
  ^+  claims
  %-  malt
  %+  skip  ~(tap by claims)
  |=  [s=ship c=claim:manor]
  ?&  ?=(~ entered.c)
      ?=(^ expires.c)
      (gte now.bowl u.expires.c)
  ==
::
::  the moons Theseus says can take a visitor: running, not paused or
::  being restored, and every installed desk caught up with its source
::
++  ready-moons
  ^-  (set ship)
  =/  rows  (ja (~(gut by (jo theseus-ui)) 'moons' ~))
  =|  out=(set ship)
  |-  ^-  (set ship)
  ?~  rows  out
  =/  row  (jo i.rows)
  =/  who  (slaw %p (js (~(gut by row) 'ship' ~)))
  ?~  who  $(rows t.rows)
  =/  ok=?
    ?&  =('healthy' (js (~(gut by row) 'status' ~)))
        =([%b |] (~(gut by row) 'paused' [%b &]))
        =(~ (~(gut by row) 'recovery' ~))
        %+  levy  (ja (~(gut by row) 'desks' ~))
        |=(d=json =('running' (js (~(gut by (jo d)) 'stage' ~))))
    ==
  $(rows t.rows, out ?:(ok (~(put in out) u.who) out))
::
::  Caddy fetches a certificate only for the join host and pool moons
::
++  allow-certificate
  |=  domain=(unit @t)
  ^-  ?
  ?~  domain  |
  ?:  =('' base.settings)  |
  =/  tail=@t  (cat 3 '.' base.settings)
  ?:  =(u.domain (cat 3 'join' tail))  &
  =/  len  (met 3 u.domain)
  =/  tln  (met 3 tail)
  ?.  &((gth len tln) =(tail (rsh [3 (sub len tln)] u.domain)))  |
  =/  who  (slaw %p (cat 3 '~' (end [3 (sub len tln)] u.domain)))
  ?~  who  |
  ?:  =(%ships visitor-pool)  (~(has by ships.full) u.who)
  (~(has by pool) u.who)
::
++  has-moon-cookie
  |=  [req=inbound-request:eyre who=ship]
  ^-  ?
  =/  c  (get-header:http 'cookie' header-list.request.req)
  ?~  c  |
  ?=(^ (find (trip (rap 3 ~['urbauth-' (scot %p who) '='])) (trip u.c)))
::
++  file-payload
  |=  [pax=path type=@t]
  ^-  simple-payload:http
  =/  data=@  .^(@ %cx (weld /(scot %p our.bowl)/[q.byk.bowl]/(scot %da now.bowl) pax))
  :_  `[(met 3 data) data]
  [200 ['content-type' type] ['cache-control' 'max-age=300'] ~]
::
++  redirect
  |=  to=@t
  ^-  simple-payload:http
  [[303 ['location' to] ['cache-control' 'no-store'] ~] ~]
::
::  a small page for visitors, in the lever page's style
::
++  page
  |=  [status=@ud title=@t body=@t]
  ^-  simple-payload:http
  :_  `(as-octs:mimes:html (page-html title body))
  [status ['content-type' 'text/html; charset=utf-8'] ['cache-control' 'no-store'] ~]
::
++  page-html
  |=  [title=@t body=@t]
  ^-  @t
  %-  crip
  %-  en-xml:html
  ;html
    ;head
      ;meta(charset "utf-8");
      ;meta(name "viewport", content "width=device-width, initial-scale=1");
      ;title: {(trip title)}
      ;style: {page-style}
    ==
    ;body
      ;main
        ;h1: {(trip title)}
        ;p: {(trip body)}
        ;p
          ;a(href "/"): Back to the lever
        ==
      ==
    ==
  ==
::
++  page-style
  ^-  tape
  %-  trip
  '''
  body { margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 1.25rem; background: #f6f5f1;
    color: #1b1a17; line-height: 1.55;
    font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif; }
  main { max-width: 480px; text-align: center; }
  h1 { font-size: 1.3rem; }
  a { color: inherit; }
  @media (prefers-color-scheme: dark) {
    body { background: #14130f; color: #eceadf; } }
  '''
::
::  ---------------------------------------------------------------------
::  the admin page's view: the pool, claims, settings and activity
::
++  state-json
  ^-  json
  %-  pairs:enjs:format
  :~  :-  %fleet
      ?~  fleet  ~
      %-  pairs:enjs:format
      :~  [%name s+name.u.fleet]
          [%snapshot (path:enjs:format snapshot.u.fleet)]
      ==
    ::
      :-  %settings
      %-  pairs:enjs:format
      :~  [%base s+base.settings]
          [%landing s+landing.settings]
      ==
    ::
      [%pool a+(turn ~(tap by pool) pool-row)]
      [%managed (json-state:~(. manor-pool [bowl full]) =(%ships visitor-pool))]
      ['visitorPool' s+visitor-pool]
      [%controlled controlled-json]
      :-  'pairRequests'
      :-  %a
      %+  turn  ~(tap by pair-requests)
      |=  [who=ship at=@da]
      (pairs:enjs:format ~[[%ship s+(scot %p who)] [%at (ms at)]])
      [%front ?~(front ~ (ms u.front))]
      [%host s+(scot %p our.bowl)]
      [%eyre (numb:enjs:format -:.^([@ud (unit @ud)] %e /(scot %p our.bowl)/ports/(scot %da now.bowl)))]
    ::
      :-  %log
      :-  %a
      %+  turn  log
      |=  [at=@da text=@t]
      (pairs:enjs:format ~[[%at (ms at)] [%text s+text]])
  ==
::
++  controlled-json
  ^-  json
  =/  c  snapshot:~(. control [bowl controlled])
  %-  pairs:enjs:format
  :~  [%controller ?~(controller.c ~ s+(scot %p u.controller.c))]
      [%landing s+landing.c]
      [%required a+(turn ~(tap in required.c) |=(d=desk s+d))]
      [%ready b+ready.c]
      [%busy b+busy.c]
      [%profile ?~(profile.c ~ u.profile.c)]
      [%generation (numb:enjs:format generation.c)]
      [%apps inventory-json:~(. control [bowl controlled])]
  ==
::
++  pool-row
  |=  [who=@p snap=path]
  ^-  json
  =/  c  (~(get by claims) who)
  %-  pairs:enjs:format
  :~  [%ship s+(scot %p who)]
      [%snapshot (path:enjs:format snap)]
      :-  %claim
      ?~  c  ~
      %-  pairs:enjs:format
      :~  [%at (ms at.u.c)]
          [%expires ?~(expires.u.c ~ (ms u.expires.u.c))]
          [%entered ?~(entered.u.c ~ (ms u.entered.u.c))]
      ==
  ==
::
++  ms
  |=  d=@da
  ^-  json
  (numb:enjs:format (unm:chrono:userlib d))
::
::  the admin page and its icon, for the owner only
::
++  serve
  |=  req=inbound-request:eyre
  ^-  simple-payload:http
  ::  Eyre pokes as the requester's identity, so only the owner's session
  ::  arrives with src = our
  ?.  &(authenticated.req =(src.bowl our.bowl))
    (login-redirect:gen:server request.req)
  ?.  =('GET' method.request.req)  [[405 ~] ~]
  =/  here=path  /(scot %p our.bowl)/[q.byk.bowl]/(scot %da now.bowl)
  ?:  =('/apps/manor/icon.png' url.request.req)
    =/  png=@  .^(@ %cx (weld here /web/icon/png))
    :_  `[(met 3 png) png]
    [200 ['content-type'^'image/png' 'cache-control'^'max-age=3600' ~]]
  =/  page=@t  .^(@t %cx (weld here /web/manor/html))
  :_  `(as-octs:mimes:html page)
  [200 ['content-type'^'text/html' 'cache-control'^'no-store' ~]]
--
