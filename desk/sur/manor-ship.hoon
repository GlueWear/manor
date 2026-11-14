::  Manor's managed-ship control protocol. Pairing is always a local action.
|%
+$  installed-app  [desk=desk running=? web=?]
+$  action
  $%  [%pair controller=(unit ship)]
      [%configure landing=desk required=(set desk)]
      [%session rid=@ta]
      [%revoke rid=@ta]
      [%profile rid=@ta name=(unit (unit @t)) avatar=(unit (unit @t))]
      [%report ~]
  ==
+$  status
  $:  who=ship
      controller=(unit ship)
      port=@ud
      landing=desk
      required=(set desk)
      ready=?
      busy=?
      generation=@ud
      profile=(unit json)
  ==
+$  result
  $%  [%session cookie=@t]
      [%revoked generation=@ud]
      [%profile profile=(unit json)]
      [%error reason=@t]
  ==
+$  reply  [rid=@ta =result]
+$  work
  $:  rid=@ta
      op=?(%session %revoke %profile)
      stage=?(%login %logout %profile)
      serial=@ud
      deadline=@da
  ==
+$  local-state
  $:  controller=(unit ship)
      landing=desk
      required=(set desk)
      pending=(unit work)
      serial=@ud
      generation=@ud
  ==
++  initial
  ^-  local-state
  [~ %landscape (silt `(list desk)`~[%landscape]) ~ 0 0]
::
++  allowed
  |=  [our=ship src=ship controller=(unit ship)]
  ^-  ?
  |(=(our src) ?~(controller | =(src u.controller)))
++  valid-rid
  |=  rid=@ta
  ^-  ?
  =/  txt  (trip rid)
  ?&  (gth (lent txt) 0)
      (lte (lent txt) 80)
      (levy txt |=(c=@t |(&((gte c 'a') (lte c 'z')) &((gte c '0') (lte c '9')) =(c '-'))))
  ==
++  valid-profile
  |=  [name=(unit (unit @t)) avatar=(unit (unit @t))]
  ^-  ?
  ?&  ?|(?=(~ name) ?=(~ u.name) (lte (met 3 u.u.name) 256))
      ?|  ?=(~ avatar)
          ?=(~ u.avatar)
          ?&  (lte (met 3 u.u.avatar) 2.048)
              =/  url  (trip u.u.avatar)
              |(=("https://" (scag 8 url)) =("http://" (scag 7 url)))
      ==  ==
  ==
++  cookie
  |=  [who=ship body=@t]
  ^-  (unit @t)
  ?:  (gth (met 3 body) 256)  ~
  ?~  sid=(slaw %uv body)  ~
  ?:  =(0 u.sid)  ~
  `(rap 3 ~['urbauth-' (scot %p who) '=' (scot %uv u.sid)])
--
