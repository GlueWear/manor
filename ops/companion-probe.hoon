::  Inline Khan thread. Only its final boolean leaves the thread.
|^
  =/  m  (strand ,vase)
  ^-  form:m
  ((set-timeout vase) ?:(=(%__MODE__ %profile) ~m2 ~m1) run)
++  run
  =/  m  (strand ,vase)
  ^-  form:m
  ?:  =(%__MODE__ %smoke)  (pure:m !>(%.y))
  ~|  %probe-status
  ;<  st=status:protocol  bind:m  (read-status ~__TARGET__)
  ?>  =(~__TARGET__ who.st)
  ?>  =(__PORT__ port.st)
  ?>  ready.st
  ?<  busy.st
  ?:  =(%__MODE__ %status)  (pure:m !>(%.y))
  ?:  =(%__MODE__ %profile-backup)
    ?~  profile.st  (strand-fail %probe-profile-missing ~)
    (pure:m !>((rip 3 (en:json:html (visible-profile u.profile.st)))))
  ?:  =(%__MODE__ %profile)  (profile-test st)
  ?:  =(%__MODE__ %profile-restore)  restore-profile
  ~|  %probe-unauthenticated-http
  ;<  baseline=@ud  bind:m  (http-status port.st ~ %.n)
  ?.  (unauthorized baseline)
    (strand-fail (http-failure 'probe-baseline' baseline) ~)
  ?:  =(%__MODE__ %baseline)  (pure:m !>(%.y))
  ~|  %probe-session
  ;<  opened=reply:protocol  bind:m  (rpc ~__TARGET__ %session ~ ~)
  ?.  ?=([%session *] result.opened)
    (strand-fail (rpc-failure opened) ~)
  =/  cookie=@t  cookie.result.opened
  ~|  %probe-authenticated-http
  ;<  accepted=@ud  bind:m  (http-status port.st `cookie %.n)
  ?.  =(200 accepted)  (strand-fail (http-failure 'probe-authenticated' accepted) ~)
  ?:  =(%__MODE__ %session)
    ~|  %probe-temporary-session-logout
    ;<  closed=@ud  bind:m  (http-status port.st `cookie %.y)
    ?.  =(303 closed)  (strand-fail (http-failure 'probe-logout' closed) ~)
    ;<  rejected=@ud  bind:m  (http-status port.st `cookie %.n)
    ?.  (unauthorized rejected)  (strand-fail (http-failure 'probe-logged-out' rejected) ~)
    (pure:m !>(%.y))
  ~|  %probe-revoke
  ;<  revoked=reply:protocol  bind:m  (rpc ~__TARGET__ %revoke ~ ~)
  ?.  ?=([%revoked *] result.revoked)  (strand-fail (rpc-failure revoked) ~)
  ?>  (gth generation.result.revoked generation.st)
  ~|  %probe-revoked-http
  ;<  rejected=@ud  bind:m  (http-status port.st `cookie %.n)
  ?.  (unauthorized rejected)  (strand-fail (http-failure 'probe-revoked' rejected) ~)
  (pure:m !>(%.y))
++  unauthorized
  |=  status=@ud
  ^-  ?
  |(=(401 status) =(403 status) =(303 status) =(307 status))
++  http-failure
  |=  [stage=@t status=@ud]
  ^-  term
  (slav %tas (rap 3 ~[stage '-' (scot %ud status)]))
++  rpc-failure
  |=  answer=reply:protocol
  ^-  term
  ?.  ?=([%error *] result.answer)  %probe-unexpected-agent-result
  =/  why  reason.result.answer
  ?:  =('Landing desks are not running.' why)  %probe-agent-not-ready
  ?:  =('Moon Eyre refused the login request.' why)  %probe-agent-login-refused
  ?:  =('Moon Eyre returned no session.' why)  %probe-agent-no-session
  ?:  =('Moon Eyre returned an invalid session.' why)  %probe-agent-invalid-session
  ?:  =('Moon HTTP request was interrupted.' why)  %probe-agent-http-interrupted
  ?:  =('Moon logout was not confirmed.' why)  %probe-agent-logout-unconfirmed
  ?:  =('Owner sessions remain; this moon must not be freed.' why)  %probe-agent-sessions-remain
  ?:  =('Moon control request timed out; do not assume the action did not run.' why)  %probe-agent-timeout
  %probe-agent-error
++  read-status
  |=  target=ship
  =/  m  (strand ,status:protocol)
  ^-  form:m
  ;<  ~  bind:m  (watch /status [target %manor-moon] /status)
  ;<  got=cage  bind:m  (take-fact /status)
  ;<  ~  bind:m  (leave /status [target %manor-moon])
  (pure:m ;;(status:protocol q.q.got))
++  profile-field
  |=  [doc=json key=@t]
  ^-  json
  ?.  ?=([%o *] doc)  ~
  (~(gut by p.doc) key ~)
++  visible-profile
  |=  doc=json
  ^-  json
  (pairs:enjs:format ~[['displayName' (profile-field doc 'displayName')] ['avatar' (profile-field doc 'avatar')]])
++  original-profile
  ^-  json
  (need (de:json:html __ORIGINAL_JSON__))
++  expected-avatar
  ^-  json
  (pairs:enjs:format ~[['type' s+'external'] ['url' s+'https://glurff.com/assets/favicon.png']])
++  profile-matches
  |=  [answer=reply:protocol expected=json]
  ^-  ?
  ?.  ?=([%profile *] result.answer)  |
  =/  got  profile.result.answer
  ?~  got  |
  =(expected (visible-profile u.got))
++  profile-test
  |=  initial=status:protocol
  =/  m  (strand ,vase)
  ^-  form:m
  ?~  profile.initial  (strand-fail %probe-profile-missing ~)
  ?.  =(original-profile (visible-profile u.profile.initial))
    (strand-fail %probe-profile-changed-since-backup ~)
  ;<  changed=reply:protocol  bind:m
    (rpc ~__TARGET__ %profile ``'Manor Companion Probe' ``'https://glurff.com/assets/favicon.png')
  =/  expected=json
    (pairs:enjs:format ~[['displayName' s+'Manor Companion Probe'] ['avatar' expected-avatar]])
  =/  changed-ok=?  (profile-matches changed expected)
  ::  Restore before asserting the write result, including a returned error.
  ;<  restored=vase  bind:m  restore-profile
  ?.  changed-ok  (strand-fail %probe-profile-write-failed ~)
  (pure:m !>(%.y))
++  restore-profile
  =/  m  (strand ,vase)
  ^-  form:m
  ;<  restored=reply:protocol  bind:m
    (rpc ~__TARGET__ %profile __RESTORE_NAME__ __RESTORE_AVATAR__)
  ?.  (profile-matches restored original-profile)
    (strand-fail %probe-profile-restore-failed ~)
  (pure:m !>(%.y))
++  rpc
  |=  [target=ship op=?(%session %revoke %profile) name=(unit (unit @t)) avatar=(unit (unit @t))]
  =/  m  (strand ,reply:protocol)
  ^-  form:m
  ;<  eny=@uvJ  bind:m  get-entropy
  =/  rid=@ta
    (cat 3 'probe-' (crip (skip (trip (scot %uv (end [3 8] eny))) |=(c=@t =(c '.')))))
  =/  request=action:protocol
    ?-  op
      %session  [%session rid]
      %revoke   [%revoke rid]
      %profile  [%profile rid name avatar]
    ==
  ;<  ~  bind:m  (watch /reply [target %manor-moon] /result/[rid])
  ;<  ~  bind:m
    %-  send-raw-card
    [%pass /rpc %agent [target %manor-moon] %poke %manor-moon-action !>(request)]
  ;<  ~  bind:m  (take-poke-ack /rpc)
  ;<  got=cage  bind:m  (take-fact /reply)
  ;<  ~  bind:m  (take-kick /reply)
  =/  answer  ;;(reply:protocol q.q.got)
  ?>  =(rid rid.answer)
  (pure:m answer)
++  http-status
  |=  [port=@ud cookie=(unit @t) logout=?]
  =/  m  (strand ,@ud)
  ^-  form:m
  =/  endpoint=@t
    ?:(logout '/~/logout' '/~/scry/manor-moon/status.noun')
  =/  url=@t  (rap 3 ~['http://127.0.0.1:' (crip (a-co:co port)) endpoint])
  =/  request=request:http
    :*  ?:(logout %'POST' %'GET')  url
        ?~(cookie ~ ~[['cookie' u.cookie]])
        ~
    ==
  ;<  ~  bind:m
    (send-raw-card [%pass /request %arvo %i %request request [0 0]])
  ;<  response=client-response:iris  bind:m  take-client-response
  ?>  ?=([%finished *] response)
  (pure:m status-code.response-header.response)
--
