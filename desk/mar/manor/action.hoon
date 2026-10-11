::  admin actions, from the %manor page as JSON
::
/-  manor
|_  act=action:manor
++  grab
  |%
  ++  noun  action:manor
  ++  json
    =,  dejs:format
    %-  of
    :~  [%connect (ot ~[fleet+(se %tas) snapshot+pa])]
        [%reset (ot ~[ships+(ar (se %p))])]
        [%release (ot ~[ships+(ar (se %p))])]
        [%remove (ot ~[ships+(ar (se %p))])]
        [%settings (ot ~[base+so landing+so])]
    ==
  --
++  grow
  |%
  ++  noun  act
  --
++  grad  %noun
--
