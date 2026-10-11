::  %manor: hand this ship's Theseus moons to visitors, and reset them
::
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
