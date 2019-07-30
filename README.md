# warparse

# What it does:

Parses all sets on warframe.market, their parts and sorts by the difference between the set and the sum of its parts.

# Usage:

Windows: start run.bat

Linux: start run.sh

# Example result:

```javascript
{
  "config": null,
  "start": "30.07.2019 22:50:38",
  "end": "30.07.2019 22:51:34",
  "duration": 55.378,
  "result": [
    {
      "profit": 47,
      "name": "Ember Prime",
      "orders": [
        {
          "platinum": 130,
          "ducats": 0,
          "message": "/w forezone hi! wtb your [Ember Prime Set] for 130 :platinum: :)",
          "region": "en",
          "part": "https://warframe.market/items/ember_prime_set",
          "user": "https://warframe.market/profile/forezone",
          "update": "29.07.2019 09:42:21"
        },
        {
          "platinum": 15,
          "ducats": 15,
          "message": "/w TWeZzerd hi! wtb your [Ember Prime Neuroptics] for 15 :platinum: :)",
          "region": "en",
          "part": "https://warframe.market/items/ember_prime_neuroptics",
          "user": "https://warframe.market/profile/TWeZzerd",
          "update": "30.07.2019 16:39:11"
        },
        {
          "platinum": 18,
          "ducats": 45,
          "message": "/w Jettesnell hi! wtb your [Ember Prime Systems] for 18 :platinum: :)",
          "region": "sv",
          "part": "https://warframe.market/items/ember_prime_systems",
          "user": "https://warframe.market/profile/Jettesnell",
          "update": "30.07.2019 22:02:49"
        },
        {
          "platinum": 10,
          "ducats": 15,
          "message": "/w thebihkiller1999 hi! wtb your [Ember Prime Chassis] for 10 :platinum: :)",
          "region": "en",
          "part": "https://warframe.market/items/ember_prime_chassis",
          "user": "https://warframe.market/profile/thebihkiller1999",
          "update": "30.07.2019 22:39:43"
        },
        {
          "platinum": 40,
          "ducats": 100,
          "message": "/w jr-koenie hi! wtb your [Ember Prime] bp for 40 :platinum: :)",
          "region": "en",
          "part": "https://warframe.market/items/ember_prime_blueprint",
          "user": "https://warframe.market/profile/jr-koenie",
          "update": "30.07.2019 22:35:40"
        }
      ],
      "needed": 83,
      "ducats": 175
    },
    ...
}
```