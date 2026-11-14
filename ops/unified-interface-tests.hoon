::  Exercise the real JSON action mark, including omitted/null profile fields.
=/  notice  ~(. notice-mark ~)
=/  notice-gate  noun:grab.notice
?>  =(~ (notice-gate ~))
?>  =(~ (mole |.((notice-gate 1))))
?>  =(~ noun:grow.notice)
=/  mark  ~(. action-mark *action:manor)
=/  decode  json:grab.mark
~|  %hosting-selects-a-known-visitor-pool
?>  =([%hosting 'glurff.com' '/apps/glurff/' %ships] (decode (need (de:json:html '{"hosting":{"base":"glurff.com","landing":"/apps/glurff/","pool":"ships"}}'))))
?>  =(~ (mole |.((decode (need (de:json:html '{"hosting":{"base":"glurff.com","landing":"/apps/glurff/","pool":"other"}}'))))))
~|  %register-auto-endpoint
?>  =([%ship-add ~zod ~] (decode (need (de:json:html '{"ship-add":{"who":"~zod"}}'))))
~|  %register-explicit-endpoint
?>  =([%ship-add ~mignes-magtel `['ships.example.com' 443 &]] (decode (need (de:json:html '{"ship-add":{"who":"~mignes-magtel","endpoint":{"host":"ships.example.com","port":443,"secure":true}}}'))))
~|  %approve-reject-and-forget
?>  =([%ship-approve ~zod ~] (decode (need (de:json:html '{"ship-approve":{"who":"~zod"}}'))))
?>  =([%ship-reject ~zod] (decode (need (de:json:html '{"ship-reject":{"who":"~zod"}}'))))
?>  =([%ship-forget ~zod] (decode (need (de:json:html '{"ship-forget":{"who":"~zod"}}'))))
~|  %profile-keep-clear-set
?>  =([%ship-profile ~zod ~ ~] (decode (need (de:json:html '{"ship-profile":{"who":"~zod"}}'))))
?>  =([%ship-profile ~zod `~ `~] (decode (need (de:json:html '{"ship-profile":{"who":"~zod","name":null,"avatar":null}}'))))
?>  =([%ship-profile ~zod ``'Pilot' ``'https://example.com/pic.png'] (decode (need (de:json:html '{"ship-profile":{"who":"~zod","name":"Pilot","avatar":"https://example.com/pic.png"}}'))))
~|  %required-desks-are-a-set
?>  =([%ship-configure ~zod %glurff (silt `(list desk)`~[%glurff %noltbook])] (decode (need (de:json:html '{"ship-configure":{"who":"~zod","landing":"glurff","required":["glurff","noltbook","glurff"]}}'))))
?>  =([%managed-configure %landscape (silt `(list desk)`~[%landscape])] (decode (need (de:json:html '{"managed-configure":{"landing":"landscape","required":["landscape"]}}'))))
~|  %pair-and-unpair
?>  =([%pair `~siglup-narwet] (decode (need (de:json:html '{"pair":{"controller":"~siglup-narwet"}}'))))
?>  =([%pair ~] (decode (need (de:json:html '{"pair":{"controller":null}}'))))
