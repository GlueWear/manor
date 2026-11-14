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
        [%hosting (ot ~[base+so landing+so pool+(su (perk %ships %theseus ~))])]
        [%full-add (ot ~[who+(se %p)])]
        [%full-remove (ot ~[who+(se %p)])]
        [%full-unlock (ot ~[who+(se %p)])]
        [%ship-add (ou ~[[%who (un (se %p))] [%endpoint (uf ~ (mu (ot ~[host+so port+ni secure+bo])))]])]
        [%ship-approve (ou ~[[%who (un (se %p))] [%endpoint (uf ~ (mu (ot ~[host+so port+ni secure+bo])))]])]
        [%ship-reject (ot ~[who+(se %p)])]
        [%ship-reconnect (ot ~[who+(se %p)])]
        [%ship-upgrade (ot ~[who+(se %p)])]
        [%ship-remove (ot ~[who+(se %p)])]
        [%ship-forget (ot ~[who+(se %p)])]
        [%ship-unlock (ot ~[who+(se %p)])]
        [%ship-profile (ou ~[[%who (un (se %p))] [%name (uf ~ (pe ~ (mu so)))] [%avatar (uf ~ (pe ~ (mu so)))]])]
        [%ship-configure (ot ~[who+(se %p) landing+(se %tas) required+(as (se %tas))])]
        [%pair (ot ~[controller+(mu (se %p))])]
        [%managed-configure (ot ~[landing+(se %tas) required+(as (se %tas))])]
    ==
  --
++  grow
  |%
  ++  noun  act
  --
++  grad  %noun
--
