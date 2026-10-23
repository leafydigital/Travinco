const dotenv = require('dotenv');
dotenv.config({ path: 'd:/Travinco/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, anonKey);

const packagesData = [
  {
    id: '91cfc3b5-90fa-44e0-a464-e1c4e8963150',
    title: 'Kodaikanal Misty Lake & Pine Forest Escape',
    child_price: 5500,
    pickup_info: 'Pickup & drop from Madurai Airport / Railway Station or Dindigul Junction',
    highlights: [
      'Scenic rowing & pedal boating across the star-shaped Kodaikanal Lake',
      'Panoramic cliff edge views from Pillar Rocks and Coaker’s Walk',
      'Walk through the majestic, fragrant tall Pine Forest and Guna Caves',
      'Visit Silver Cascade Waterfalls and Bryant Park blooming botanical gardens',
      'Chocolates & homemade essential oils shopping at local Tibetan market',
    ],
    full_description: `Escape to the "Princess of Hill Stations" with Travinco's signature 3-day Kodaikanal holiday. Perched high in the mist-crowned Palani Hills of Tamil Nadu, Kodaikanal offers a refreshing cool climate, aromatic pine groves, calm lakes, and dramatic cliff viewpoints.

Your holiday begins with a comfortable scenic drive rising through hairpin bends with viewpoints of the Western Ghats. Spend peaceful mornings boating on the mirror-like waters of Kodai Lake, taking leisurely strolls along Coaker's Walk with valley mist drifting beneath your feet, and capturing the dramatic granite towers of Pillar Rocks. 

In the afternoons, breathe in the fresh alpine scent of the historic Pine Forests planted over a century ago, explore the mysterious rock formations of Guna Caves, and witness the roaring waters of Silver Cascade. Perfect for families, couples, and nature enthusiasts seeking an unhurried hill retreat with premium accommodation and private vehicle service.`,
    meta_title: 'Kodaikanal Misty Lake & Pine Forest Tour Package | Travinco',
    meta_description: 'Book 3 Days Kodaikanal holiday with star-shaped lake boating, Coaker Walk, Pillar Rocks, Pine Forests, premium stay and private vehicle transfer.',
    inclusions: [
      '2 Nights accommodation in 3-star / 4-star hilltop resort',
      'Daily delicious breakfast and buffet dinner at hotel',
      'All airport / railway station transfers by private AC vehicle',
      'Full day local Kodaikanal sightseeing and viewpoint tours',
      'Rowing / pedal boat ticket at Kodaikanal Lake',
      'Toll charges, parking fees, interstate road taxes, and driver allowance',
      '24/7 dedicated on-call concierge assistance from Travinco',
    ],
    exclusions: [
      'Airfare or train tickets to/from Madurai / Dindigul',
      'Lunches, snacks, and personal beverages',
      'Entry camera fees at parks and monuments',
      'Horse riding, cycling, or optional adventure activities',
      'Anything not explicitly mentioned under inclusions',
    ],
    itinerary: [
      {
        day_number: 1,
        title: 'Arrival in Madurai & Scenic Drive to Kodaikanal',
        description: 'Meet and greet by your Travinco chauffeur at Madurai Airport/Railway station. Enjoy a scenic 3-hour uphill drive past Silver Cascade Falls. Check in at your hillside resort. Evening free to stroll along the famous Kodaikanal Lake and local craft markets.',
        hotel: 'Hill Country Resort / The Carlton or similar',
        meals: 'Dinner',
        transport: 'Private AC Sedan / SUV',
      },
      {
        day_number: 2,
        title: 'Kodaikanal Viewpoints, Pine Forest & Lake Boating',
        description: 'After a hearty breakfast, embark on a full day sightseeing tour. Visit Coaker’s Walk for panoramic valley views, Upper Lake View, Pillar Rocks, Green Valley View, and the century-old Pine Forest. Afternoon boat cruise on Kodai Lake followed by Bryant Park flora exploration.',
        hotel: 'Hill Country Resort / The Carlton or similar',
        meals: 'Breakfast & Dinner',
        transport: 'Private AC Sedan / SUV',
      },
      {
        day_number: 3,
        title: 'Kurinji Temple, Chettiar Park & Departure',
        description: 'Enjoy a leisurely breakfast surrounded by morning mist. Visit Kurinji Andavar Temple dedicated to Lord Murugan and Chettiar Park. Shop for homemade chocolates, eucalyptus oils, and spices before descending back to Madurai for your onward journey.',
        hotel: 'Check out',
        meals: 'Breakfast',
        transport: 'Private AC Sedan / SUV transfer to Madurai',
      },
    ],
    faqs: [
      {
        question: 'Which is the nearest airport or railway station to Kodaikanal?',
        answer: 'Madurai Airport (IXM) is the nearest airport, located approximately 120 km (about 3 to 3.5 hours drive). Madurai and Dindigul Railway stations are the most convenient rail heads.',
      },
      {
        question: 'What is the best time to visit Kodaikanal?',
        answer: 'Kodaikanal is pleasant throughout the year. October to March is cool and misty with temperatures between 10°C to 20°C. April to June offers pleasant summer respite from city heat.',
      },
      {
        question: 'Can this package be customized for honeymoon couples or family groups?',
        answer: 'Yes, our holiday planners can tailor room categories (such as valley-view suites), add candlelight dinners, floral bed decoration, or adjust vehicle size for larger families.',
      },
    ],
  },
  {
    id: '6ead866a-0167-4272-98d0-bfd3c9ec603f',
    title: 'Rameshwaram & Madurai Sacred Heritage Circuit',
    child_price: 7000,
    pickup_info: 'Pickup & drop from Madurai Airport or Railway Station',
    highlights: [
      'Darshan at the historic Madurai Meenakshi Amman Temple with golden lotus tank',
      'Walk through the world’s longest pillared corridor at Ramanathaswamy Temple',
      'Scenic drive across the legendary Pamban Sea Bridge with ocean views',
      'Excursion to ghost town of Dhanushkodi and Ram Setu viewpoint',
      'Visit Thirumalai Nayakkar Palace light & sound show and APJ Abdul Kalam Memorial',
    ],
    full_description: `Journey into the spiritual heart of South India with Travinco's thoughtfully crafted 4-Day Madurai & Rameshwaram Heritage Circuit. This pilgrimage and cultural journey connects the historic temple city of Madurai with the sacred island of Rameshwaram on the Gulf of Mannar.

Begin in Madurai, one of the oldest continuously inhabited cities in the world. Marvel at the soaring gopurams of Meenakshi Amman Temple, intricately carved with thousands of colorful mythological figures. Explore the grand Indo-Saracenic archways of Thirumalai Nayak Palace.

Cross the engineering marvel of Pamban Bridge over azure waters onto Pamban Island. In Rameshwaram, take sacred baths in the 22 holy teerthams and walk down the magnificent 1,200-meter pillared corridor of Ramanathaswamy Temple. Venture to the haunting, windswept sands of Dhanushkodi, where the Indian Ocean meets the Bay of Bengal at the historic tip of Adam's Bridge (Ram Setu).`,
    meta_title: 'Madurai & Rameshwaram Temple Tour Package 4 Days | Travinco',
    meta_description: 'Book 4-day Madurai & Rameshwaram heritage tour. Visit Meenakshi Temple, Pamban Bridge, Ramanathaswamy Temple corridor, and Dhanushkodi with private AC vehicle.',
    inclusions: [
      '1 Night accommodation in Madurai & 2 Nights in Rameshwaram',
      'Daily vegetarian breakfast at hotels',
      'All transfers and sightseeing by dedicated private AC vehicle',
      'Interstate road taxes, toll plaza charges, parking fees, and driver allowance',
      'Assistance for temple entry timings and queue guidance',
      'Sightseeing tour to Dhanushkodi, APJ Abdul Kalam Memorial & Pamban Bridge',
    ],
    exclusions: [
      'Train / flight tickets to and from Madurai',
      'Special darshan tickets, puja charges, and priest dakshina',
      'Lunches, dinners, and personal temple offerings',
      'Camera and electronic device storage locker fees at temples',
    ],
    itinerary: [
      {
        day_number: 1,
        title: 'Arrival in Madurai & Meenakshi Amman Temple',
        description: 'Arrive at Madurai Airport/Railway Station. Meet your driver and check in at hotel. In the afternoon, visit the magnificent Meenakshi Amman Temple, Thousand Pillar Hall, and Thirumalai Nayakkar Palace. Witness the evening night-ceremony procession inside the temple.',
        hotel: 'Heritage Madurai / Courtyard by Marriott or similar',
        meals: 'Breakfast at hotel',
        transport: 'Private AC vehicle',
      },
      {
        day_number: 2,
        title: 'Drive to Rameshwaram via Pamban Sea Bridge',
        description: 'After breakfast, drive to Rameshwaram (approx. 3.5 hrs). Cross the iconic Pamban Bridge with breathtaking vistas of the sea and train tracks. Check in at your hotel in Rameshwaram. Evening darshan at Arulmigu Ramanathaswamy Temple, exploring its famous 1,200 carved stone pillars.',
        hotel: 'Daiwik Hotel / Hyatt Place Rameshwaram or similar',
        meals: 'Breakfast at hotel',
        transport: 'Private AC vehicle',
      },
      {
        day_number: 3,
        title: 'Holy Teerthams, Dhanushkodi & Ram Setu',
        description: 'Early morning holy dip at Agni Teertham and bath at the 22 temple kunds. After breakfast, excursion to Dhanushkodi—the submerged ghost town destroyed in the 1964 cyclone. See the ruins of the church, railway station, and the beginning point of Ram Setu (Adam’s Bridge). Evening visit to APJ Abdul Kalam Memorial.',
        hotel: 'Daiwik Hotel / Hyatt Place Rameshwaram or similar',
        meals: 'Breakfast at hotel',
        transport: 'Private AC vehicle / 4x4 Jeep for beach stretch',
      },
      {
        day_number: 4,
        title: 'Kothandaramaswamy Temple & Return to Madurai',
        description: 'Visit the peaceful Kothandaramaswamy Temple surrounded by turquoise sea water. Check out and drive back to Madurai Airport/Railway station for departure, carrying sacred memories of your holy pilgrimage.',
        hotel: 'Check out',
        meals: 'Breakfast at hotel',
        transport: 'Private AC vehicle transfer to Madurai',
      },
    ],
    faqs: [
      {
        question: 'What is the dress code for Madurai Meenakshi Temple and Rameshwaram?',
        answer: 'Strict traditional dress code applies at both temples. Men must wear dhoti/mundu with shirt/angavastram or formal trousers with shirt. Women must wear sarees, half-sarees, or churidars with dupatta. Jeans, shorts, and sleeveless tops are not permitted.',
      },
      {
        question: 'Are mobile phones allowed inside Meenakshi Temple and Ramanathaswamy Temple?',
        answer: 'Mobile phones, smartwatches, and cameras are strictly banned inside both temple sanctums. Safe paid locker facilities are available near the entrance gates.',
      },
      {
        question: 'Can senior citizens get wheelchair assistance?',
        answer: 'Yes, battery cars and wheelchair assistance can be arranged at both temple complexes with advance notice.',
      },
    ],
  },
  {
    id: '5ff4b1d6-55d3-4671-ad76-2b9f91de27d8',
    title: 'Maldives Coral Reef & Private Sandbank Picnic',
    child_price: 25000,
    pickup_info: 'Speedboat transfer directly from Velana International Airport (Malé)',
    highlights: [
      'Round-trip speedboat transfers cutting through crystal clear Indian Ocean waters',
      'Exclusive private sandbank excursion with setup umbrella, towels & tropical fruit lunch',
      'Guided coral reef snorkeling safari alongside sea turtles, rays, and tropical reef fish',
      'Sunset dolphin cruise watching spinner dolphins leap in the golden twilight',
      'Comfortable beachside island stay with white powdered sands at your doorstep',
    ],
    full_description: `Immerse yourself in tropical paradise with Travinco’s 4-Day Maldives Coral Reef & Private Sandbank Picnic. Crafted for adventure lovers, couples, and ocean enthusiasts, this package brings you the authentic Maldivian island experience with vibrant marine life and turquoise lagoons.

Your journey begins right at Malé Airport, where a high-speed boat whisks you across the turquoise Atolls to a picturesque local island resort. Step onto powdery white sand, kick off your shoes, and feel the warm ocean breeze.

The crown jewel of this trip is a private half-day voyage to an uninhabited virgin sandbank—a strip of pure white coral sand surrounded by 360-degree turquoise waters. Snorkel through vibrant outer house reefs accompanied by our certified PADI marine guides, witness schools of clownfish and gentle sea turtles, and finish the day on a breathtaking sunset cruise tracing pod of spinner dolphins.`,
    meta_title: 'Maldives Sandbank Picnic & Snorkeling Safari 4 Days | Travinco',
    meta_description: 'Book 4-day Maldives adventure package with private sandbank picnic, coral reef snorkeling, dolphin cruise, and roundtrip speedboat airport transfers.',
    inclusions: [
      '3 Nights deluxe beachfront accommodation in a boutique island resort',
      'Daily tropical buffet breakfast and dinners',
      'Round-trip airport speedboat transfers from Velana International Airport',
      'Half-day private sandbank excursion with picnic lunch and beach umbrellas',
      'Guided coral reef snorkeling with high-grade masks, snorkel fins & life jackets',
      'Sunset dolphin spotting cruise with refreshments',
      'Maldives Green Tax and all local service charges included',
    ],
    exclusions: [
      'International flight tickets to/from Malé (MLE)',
      'Scuba diving courses or motorized water sports (jet ski, parasailing)',
      'Alcoholic beverages (subject to local island regulations)',
      'Travel insurance and personal expenses',
    ],
    itinerary: [
      {
        day_number: 1,
        title: 'Arrival in Malé & Scenic Speedboat Transfer',
        description: 'Arrive at Velana International Airport (MLE). Our airport representative welcomes you and escorts you to the speedboat jetty. Enjoy a thrilling 35-minute boat ride across turquoise atolls to your island resort. Check in, sip on fresh tender coconut water, and watch the sunset from the beach.',
        hotel: 'Deluxe Beach Villa / Boutique Island Resort',
        meals: 'Dinner',
        transport: 'Shared Speedboat Transfer',
      },
      {
        day_number: 2,
        title: 'Private Sandbank Excursion & Coral Reef Snorkel',
        description: 'After breakfast, board a traditional speed dhoni to an isolated, pure white sandbank rising out of the turquoise sea. Enjoy guided snorkeling along the colorful reef drop-off, spot sea turtles and reef fish, and relax on your private beach setup with tropical fruit skewers and snacks.',
        hotel: 'Deluxe Beach Villa / Boutique Island Resort',
        meals: 'Breakfast, Picnic Lunch & Dinner',
        transport: 'Private Speedboat excursion',
      },
      {
        day_number: 3,
        title: 'Leisure Day & Sunset Spinner Dolphin Cruise',
        description: 'Spend the morning relaxing on the beach, kayaking in the calm lagoon, or indulging in an optional spa treatment. At 5:00 PM, embark on a wooden cruise boat into the deeper channels to spot wild spinner dolphins performing acrobatic leaps against the orange sunset.',
        hotel: 'Deluxe Beach Villa / Boutique Island Resort',
        meals: 'Breakfast & Dinner',
        transport: 'Sunset Cruise Boat',
      },
      {
        day_number: 4,
        title: 'Morning Dip & Airport Speedboat Departure',
        description: 'Take one last dip in the warm ocean waters before breakfast. Pack your bags with unforgettable memories, check out, and take the scheduled speedboat transfer back to Malé Airport for your return flight.',
        hotel: 'Check out',
        meals: 'Breakfast',
        transport: 'Shared Speedboat Transfer to Malé Airport',
      },
    ],
    faqs: [
      {
        question: 'Do Indian passport holders need a visa for Maldives?',
        answer: 'No advance visa is required. Indian citizens receive a free 30-day tourist visa on arrival at Malé Airport upon showing a valid passport (minimum 6 months validity), confirmed hotel booking, and return flight tickets.',
      },
      {
        question: 'Is snorkeling equipment provided or do we need to bring our own?',
        answer: 'High-quality sanitized snorkeling masks, breathing tubes, fins, and life jackets are provided complimentary on all excursions.',
      },
      {
        question: 'Are vegetarian / Indian food options available?',
        answer: 'Yes, our partner resorts provide daily vegetarian, vegan, and Indian meal selections along with fresh continental seafood.',
      },
    ],
  },
  {
    id: '643463f6-a56a-4510-b616-9931831e0939',
    title: 'Athirappilly Waterfalls & Thekkady Tiger Reserve',
    child_price: 8500,
    pickup_info: 'Pickup & drop from Kochi (Cochin) International Airport (COK) or Aluva Railway Station',
    highlights: [
      'Stand before the roaring 80-foot cascade of Athirappilly — the Niagara of India',
      'Scenic Western Ghats mountain drive through rubber and spice plantations',
      'Boat safari on Periyar Lake inside Thekkady Periyar Tiger Reserve',
      'Guided spice plantation walk smelling cardamom, cloves, cinnamon, and pepper',
      'Authentic Kalaripayattu traditional martial arts and Kathakali cultural show',
    ],
    full_description: `Experience the raw power of nature and untamed tropical wilderness with Travinco’s 4-Day Athirappilly Waterfalls and Thekkady Tiger Reserve adventure. This journey brings together the most dramatic water cascade in South India with the wildlife-rich rainforests of the Cardamom Hills.

Begin your expedition at the majestic Athirappilly Waterfalls on the Chalakudy River. Plunging 80 feet through lush Sholayar rainforests, this thunderous cascade was made globally famous by cinematic blockbusters like Baahubali and Dil Se. Hike down the bamboo trail to feel the cool spray on your face.

Journey deeper into the Western Ghats to Thekkady, home of the Periyar National Park. Cruise quietly on Periyar Lake as herds of wild Asiatic elephants, sambar deer, gaur (Indian bison), and exotic water birds gather at the reservoir shores. Learn how cinnamon, star anise, nutmeg, and green cardamom grow on a guided organic plantation tour, and be enthralled by centuries-old Kalaripayattu martial artists.`,
    meta_title: 'Athirappilly & Thekkady Wildlife Tour Package 4 Days | Travinco',
    meta_description: 'Book 4-day Athirappilly Waterfalls and Thekkady Periyar Tiger Reserve tour package with lake boat safari, spice garden walk, and private vehicle from Kochi.',
    inclusions: [
      '1 Night stay in Athirappilly & 2 Nights in Thekkady in premium rainforest resorts',
      'Daily breakfast at all hotels',
      'Private AC vehicle for all transfers, drives, and sightseeing tours',
      'Athirappilly Waterfalls & Vazhachal reserve forest entry tickets',
      'Periyar Lake wildlife boat cruise tickets inside Periyar Tiger Reserve',
      'Guided spice plantation tour with an English/Hindi speaking naturalist',
      'All toll taxes, parking fees, and driver allowances included',
    ],
    exclusions: [
      'Airfare or train tickets to/from Kochi',
      'Lunches, dinners, and personal beverages',
      'Jungle bamboo rafting, border hiking, or jeep safari in Periyar',
      'Camera fees at forest checkpoints and wildlife sanctuaries',
    ],
    itinerary: [
      {
        day_number: 1,
        title: 'Arrival in Kochi & Drive to Athirappilly Waterfalls',
        description: 'Arrive at Kochi Airport/Aluva station. Meet your Travinco driver and drive to Athirappilly (approx. 1.5 hrs). Check in at your rainforest resort overlooking the Chalakudy river. Walk down to the base of the roaring Athirappilly Waterfalls and visit the nearby Vazhachal cascades and Charpa falls. Relax amidst lush green nature.',
        hotel: 'Rainforest Resort / Casa Rio Resort or similar',
        meals: 'Breakfast at hotel',
        transport: 'Private AC Sedan / SUV',
      },
      {
        day_number: 2,
        title: 'Scenic Ghat Drive to Thekkady & Spice Plantation Walk',
        description: 'After breakfast, take a picturesque 4.5-hour drive winding through tea plantations, rubber estates, and mist-wrapped hills to Thekkady (Periyar). Check in at your jungle lodge. In the afternoon, enjoy a sensory guided walk through an organic spice plantation to see cardamom, black pepper vines, and vanilla orchids.',
        hotel: 'Greenwoods Resort / The Elephant Court or similar',
        meals: 'Breakfast at hotel',
        transport: 'Private AC Sedan / SUV',
      },
      {
        day_number: 3,
        title: 'Periyar Lake Wildlife Safari & Kalaripayattu Show',
        description: 'Early morning boat safari on Periyar Lake inside Periyar Tiger Reserve. Keep your binoculars ready to spot wild elephant herds, wild boar, otters, and birds by the water’s edge. Afternoon free for local shopping of fresh spices and handmade chocolates. Evening witness an exhilarating live Kalaripayattu martial arts performance.',
        hotel: 'Greenwoods Resort / The Elephant Court or similar',
        meals: 'Breakfast at hotel',
        transport: 'Private AC Sedan / SUV',
      },
      {
        day_number: 4,
        title: 'Scenic Return Drive to Kochi & Departure',
        description: 'Enjoy a leisurely breakfast surrounded by chirping birds. Check out and embark on the return drive descending the Western Ghats to Kochi Airport / Aluva Railway Station for your onward journey home.',
        hotel: 'Check out',
        meals: 'Breakfast at hotel',
        transport: 'Private AC Sedan / SUV transfer to Kochi',
      },
    ],
    faqs: [
      {
        question: 'Are wild elephant sightings guaranteed on the Periyar Lake boat safari?',
        answer: 'Periyar is a thriving natural sanctuary. While wildlife sightings can never be 100% guaranteed in the wild, early morning and late afternoon boat cruises offer very high chances of spotting wild elephant herds and bison grazing by the lake shores.',
      },
      {
        question: 'Is the hike down to the bottom of Athirappilly Falls difficult?',
        answer: 'The path down to the foot of Athirappilly Falls is paved with stones and handrails (approx. 10–15 minutes walk). It is moderately easy for people of average fitness. Sturdy footwear is recommended.',
      },
      {
        question: 'What is the closest airport to start this trip?',
        answer: 'Cochin International Airport (COK) is the closest airport, located just 40 km from Athirappilly Waterfalls.',
      },
    ],
  },
  {
    id: '98b67878-2abd-47ae-b179-d9a179081261',
    title: 'Munnar Misty Hills & Tea Garden Retreat',
    child_price: 1200,
    pickup_info: 'Pickup & drop from Kochi (Cochin) Airport or Ernakulam / Aluva Railway Station',
    highlights: [
      'Lush rolling emerald tea plantations stretching across the Western Ghats horizon',
      'Visit the historic KDHP Tea Museum and witness live tea processing',
      'Boating and photography at Mattupetty Dam and Echo Point acoustic valley',
      'Spot endangered Nilgiri Tahr mountain goats in Eravikulam (Rajamalai) National Park',
      'Scenic stopovers at Cheeyappara and Valara waterfalls along the Kochi-Munnar highway',
    ],
    full_description: `Escape to the refreshing hill retreat of Munnar with Travinco's 2-Day / 1-Night nature getaway. Perched 1,600 meters above sea level in the Idukki district of Kerala, Munnar was once the summer capital of the British government in South India and remains one of Asia's premier tea plantation destinations.

Breathe in the crisp mountain air infused with the scent of eucalyptus and tea leaves. Visit the Tata Tea Museum to learn the art of tea tasting, stand on the shores of Mattupetty Dam with reflection of blue skies on deep waters, shout out into the green valley at Echo Point, and spot the endangered Nilgiri Tahr mountain goat roaming the high-altitude grasslands of Eravikulam National Park.`,
    meta_title: 'Munnar 2 Days Weekend Tour Package | Travinco',
    meta_description: 'Book 2-day Munnar tea garden package with Eravikulam National Park, Mattupetty Dam, tea museum, premium stay, and private cab from Kochi.',
    inclusions: [
      '1 Night accommodation in a premium hill resort with valley view',
      'Daily breakfast at hotel',
      'All sightseeing and transfers by dedicated private AC vehicle',
      'Toll taxes, parking fees, and driver allowances',
      'Assistance with Eravikulam National Park safari entry slots',
    ],
    exclusions: [
      'Train / flight tickets to Kochi',
      'Entry tickets to Tea Museum, Eravikulam National Park, and Mattupetty Dam boating',
      'Lunches, dinners, and personal expenses',
      'Anything not listed in the inclusions',
    ],
    itinerary: [
      {
        day_number: 1,
        title: 'Kochi to Munnar Scenic Drive & Tea Garden Exploration',
        description: 'Morning pickup from Kochi Airport or Ernakulam station. Drive to Munnar (approx. 3.5 hrs). En route, marvel at Cheeyappara and Valara Waterfalls cascading down rocky cliffs. Arrive in Munnar, check in at your resort. Afternoon visit to the Tea Museum and scenic walks through sprawling tea gardens.',
        hotel: 'Amber Dale Luxury Resort / Fragrant Nature Munnar or similar',
        meals: 'Breakfast at hotel',
        transport: 'Private AC Cab',
      },
      {
        day_number: 2,
        title: 'Eravikulam National Park, Mattupetty Dam & Departure',
        description: 'Early morning visit to Eravikulam National Park to witness the Nilgiri Tahr in their natural habitat. Next, drive to Mattupetty Dam and Echo Point for speedboating and photography. In the afternoon, descend through the hills back to Kochi Airport / Railway Station for departure.',
        hotel: 'Check out',
        meals: 'Breakfast at hotel',
        transport: 'Private AC Cab transfer to Kochi',
      },
    ],
    faqs: [
      {
        question: 'When is Eravikulam National Park closed?',
        answer: 'Eravikulam National Park is typically closed for about 6 to 8 weeks during the Nilgiri Tahr calving season, usually between February and March each year. Other Munnar attractions remain open.',
      },
      {
        question: 'Can this 2-day package be extended to 3 or 4 days?',
        answer: 'Yes! We frequently extend this package to include Top Station, Kolukkumalai sunrise jeep safari, or combine it with Thekkady and Alleppey.',
      },
    ],
  },
  {
    id: 'c4d1d9eb-7afe-4ad6-bfef-7ca50d4e33ae',
    title: 'Kerala Backwaters & Houseboat Luxury Retreat',
    child_price: 9500,
    pickup_info: 'Pickup & drop from Kochi Airport or Ernakulam Railway Station',
    highlights: [
      'Private luxury traditional thatched Kettuvallam houseboat cruise with onboard chef',
      'Gliding past water lilies, emerald paddy fields, and coir-making village shores',
      'Freshly prepared multi-course Kerala feasts (Karimeen Pollichathu, Appams, Duck roast)',
      'Sunset canoe ride through quiet narrow village canals unreachable by larger boats',
      'Resort stay in tranquil Kumarakom on the eastern shores of vast Vembanad Lake',
    ],
    full_description: `Immerse yourself in God's Own Country with Travinco’s premier 4-Day Kerala Backwaters & Houseboat Luxury Retreat. Designed for discerning travelers seeking tranquility, culinary excellence, and unmatched natural beauty, this voyage celebrates the golden waterways of Alappuzha (Alleppey) and Kumarakom.

Begin with a stay at a luxury lakeside heritage resort in Kumarakom on the edge of Vembanad Lake. The highlight of your retreat is an overnight voyage aboard your own private, handcrafted Kerala Houseboat (Kettuvallam). Fitted with air-conditioned glass bedrooms, ensuite modern bathrooms, and a personal chef and boat captain, you will drift along canals where time has stood still.

Savor authentic Kuttanad cuisine prepared fresh to your taste, watch fishermen cast Chinese fishing nets into the shimmering waters, and take a country canoe excursion into tiny village canals where Kingfishers and water hens dart between coconut palms.`,
    meta_title: 'Kerala Houseboat & Backwater Luxury Tour 4 Days | Travinco',
    meta_description: 'Book 4-day private Kerala Houseboat and Kumarakom luxury retreat. Authentic onboard dining, Vembanad lake sunset cruise, and private car from Kochi.',
    inclusions: [
      '2 Nights in a 4-star / 5-star Kumarakom lake resort & 1 Night on private AC houseboat',
      'All meals on houseboat (Welcome drink, traditional lunch, evening tea & snacks, dinner, breakfast)',
      'Daily breakfast at Kumarakom resort',
      'Dedicated private AC vehicle for all transfers and airport connectivity',
      'Complimentary country boat / canoe canal tour for 1 hour',
      'All fuel, toll charges, parking, and driver allowances included',
    ],
    exclusions: [
      'Flight / train tickets to Kochi',
      'Lunches & dinners during resort stay (available on à la carte)',
      'Ayurvedic spa treatments and massages at the resort',
      'Alcoholic drinks and personal laundry expenses',
    ],
    itinerary: [
      {
        day_number: 1,
        title: 'Arrival in Kochi & Transfer to Kumarakom Lake Resort',
        description: 'Arrive at Kochi Airport/Railway station. Your private chauffeur escorts you on a pleasant 2-hour drive through countryside villages to the tranquil shores of Kumarakom. Check in at your luxury backwater resort. Spend the evening lounging by the infinity pool overlooking Vembanad Lake.',
        hotel: 'Kumarakom Lake Resort / Zuri Kumarakom or similar',
        meals: 'Breakfast at hotel',
        transport: 'Private AC vehicle',
      },
      {
        day_number: 2,
        title: 'Board Private Luxury Houseboat in Alleppey',
        description: 'After breakfast, transfer to Alleppey boat jetty. Board your traditional handcrafted private houseboat at 12:00 noon. Set sail through the palm-fringed backwaters. Enjoy a lavish Kerala lunch featuring pearl spot fish, steamed rice, and seasonal curries. Cruise past lush green paddy fields and rustic villages until sunset. Anchor for a serene night on the water.',
        hotel: 'Private Luxury 1-Bedroom / 2-Bedroom AC Houseboat',
        meals: 'Lunch, Evening Tea & Snacks, Dinner',
        transport: 'Private Houseboat cruise',
      },
      {
        day_number: 3,
        title: 'Morning Cruise, Canoe Canal Safari & Village Walk',
        description: 'Wake up to the soft calls of water birds as morning mist rises off the lake. Enjoy a hot breakfast of appams and stew while cruising. Check out at 9:30 AM. Transfer to a lakeside retreat. In the afternoon, enjoy an intimate country canoe ride into narrow inland canals and visit a local coir weaving household.',
        hotel: 'Vasundhara Sarovar Premiere / Uday Backwater Resort or similar',
        meals: 'Breakfast at hotel',
        transport: 'Private AC vehicle',
      },
      {
        day_number: 4,
        title: 'Fort Kochi Heritage Sightseeing & Departure',
        description: 'After breakfast, drive to historic Fort Kochi. Walk past the iconic Chinese Fishing Nets, colonial Portuguese Santa Cruz Basilica, and Mattancherry Dutch Palace. Shop for handmade antiques and spices before your evening transfer to Kochi Airport for departure.',
        hotel: 'Check out',
        meals: 'Breakfast at hotel',
        transport: 'Private AC vehicle transfer to Kochi Airport',
      },
    ],
    faqs: [
      {
        question: 'Are the houseboats air-conditioned throughout the cruise?',
        answer: 'Our luxury houseboats provide full-time air conditioning in the bedrooms. For standard houseboats, air conditioning in the bedroom is operational from 9:00 PM to 6:00 AM. Luxury category houseboats can have 24-hour AC upon request.',
      },
      {
        question: 'Can the onboard chef accommodate dietary preferences (veg, Jain, non-spicy)?',
        answer: 'Yes! The personal chef on your private houseboat cooks exclusively for your party and will customize every meal to your spice, vegetarian, or Jain food preferences.',
      },
      {
        question: 'Is it safe to stay overnight on a houseboat?',
        answer: 'Yes, all houseboats are strictly anchored at designated safe mooring points along the canal banks from sunset to sunrise as per Kerala Maritime safety regulations.',
      },
    ],
  },
  {
    id: '30d7e5e0-bb83-46b7-aba8-bd627e6cc3a6',
    title: 'Wayanad Rainforest & Wildlife Trail',
    child_price: 5999,
    pickup_info: 'Pickup & drop from Calicut (Kozhikode) International Airport (CCJ) or Railway Station',
    highlights: [
      'Trek to prehistoric 6,000-year-old rock engravings inside Edakkal Caves',
      'Bamboo rafting along the tranquil Kabini River on Kuruva Dweep island',
      'Panoramic 360-degree views of three states from Banasura Sagar Dam',
      'Spot wild elephants and leopards on Muthanga Wildlife Sanctuary jeep safari',
      'Walk through mist-shrouded rainforests and emerald tea estates of Vythiri',
    ],
    full_description: `Discover the pristine wilderness of Northern Kerala with Travinco’s 3-Day Wayanad Rainforest and Wildlife Trail. Nestled in the bio-rich Western Ghats at altitudes ranging from 700 to 2,100 meters, Wayanad is a wonderland of dense evergreen jungles, spice-laden hill slopes, prehistoric caves, and misty reservoirs.

Your adventure begins with a thrilling ascent up the famous Thamarassery Churam mountain pass with its 9 dramatic hairpin bends overlooking the Malabar coast. Trek through coffee estates up Ambukuthi Hill to explore Edakkal Caves, adorned with rare Stone Age petroglyphs dating back to the Neolithic era.

Marvel at Banasura Sagar Dam—the largest earth dam in India and second largest in Asia—with its emerald islands scattered across sparkling blue waters. Embark on a sunset jeep safari through Wayanad Wildlife Sanctuary (Muthanga), where wild elephants, deer, gaur, and langurs roam free.`,
    meta_title: 'Wayanad Wildlife & Rainforest Tour Package 3 Days | Travinco',
    meta_description: 'Book 3-day Wayanad tour package with Edakkal Caves, Banasura Sagar Dam, Muthanga wildlife jeep safari, bamboo rafting, and private cab from Calicut.',
    inclusions: [
      '2 Nights accommodation in a nature resort / tree villa in Wayanad',
      'Daily breakfast and dinner at the resort',
      'All sightseeing and transfers in a dedicated private AC vehicle',
      'All toll taxes, parking fees, and driver allowances',
      'Assistance with entry passes for Edakkal Caves and Banasura Sagar Dam',
    ],
    exclusions: [
      'Airfare or train tickets to/from Calicut (Kozhikode)',
      'Jeep safari tickets inside Muthanga Wildlife Sanctuary',
      'Adventure activities (zipline, bamboo rafting, speedboating)',
      'Lunches, snacks, and personal expenses',
    ],
    itinerary: [
      {
        day_number: 1,
        title: 'Arrival in Calicut & Drive up the Ghats to Wayanad',
        description: 'Morning pickup from Calicut Airport / Railway Station. Enjoy a scenic 2.5-hour drive scaling the 9 hairpin curves of the Western Ghats with panoramic valley views. Check in at your rainforest resort. Afternoon visit to Pookode freshwater natural lake surrounded by lush green hills. Evening free to relax by the resort bonfire.',
        hotel: 'Vythiri Resort / Morickap Resort or similar',
        meals: 'Dinner',
        transport: 'Private AC vehicle',
      },
      {
        day_number: 2,
        title: 'Edakkal Caves, Soochipara Falls & Muthanga Safari',
        description: 'After breakfast, trek up to the ancient Edakkal Caves to witness Neolithic petroglyphs carved thousands of years ago. Head to the cascading three-tiered Soochipara (Sentinel Rock) Waterfalls. In the late afternoon, take a 4x4 open jeep safari through Muthanga Wildlife Sanctuary to spot wild elephants, deer, and exotic bird species.',
        hotel: 'Vythiri Resort / Morickap Resort or similar',
        meals: 'Breakfast & Dinner',
        transport: 'Private AC vehicle',
      },
      {
        day_number: 3,
        title: 'Banasura Sagar Dam, Tea Plantations & Departure',
        description: 'After breakfast, visit Banasura Sagar Dam—India’s largest earthen dam. Take an optional speed boat ride between the scattered forest islands. Stop at a local plantation factory for authentic Wayanad tea and whole black pepper before descending to Calicut for your evening departure.',
        hotel: 'Check out',
        meals: 'Breakfast',
        transport: 'Private AC vehicle transfer to Calicut',
      },
    ],
    faqs: [
      {
        question: 'Which is the nearest airport to Wayanad?',
        answer: 'Calicut (Kozhikode) International Airport (CCJ) is the nearest airport, located approximately 85 km (around 2.5 to 3 hours drive) from Wayanad.',
      },
      {
        question: 'Is the climb to Edakkal Caves suitable for elderly travelers?',
        answer: 'The climb to Edakkal Caves involves walking up a steep incline for approximately 1 km followed by around 300 stone steps. It can be physically demanding for guests with knee issues or heart conditions. Jeep shuttle service covers the first portion of the road.',
      },
    ],
  },
  {
    id: 'ed3bf475-158c-41f9-a06f-5cd2b3786d20',
    title: 'Maldives Luxury Overwater Villa Escape',
    child_price: 35000,
    pickup_info: 'Direct Speedboat / Seaplane transfer from Velana International Airport (Malé)',
    highlights: [
      'Stay in an iconic luxury Overwater Villa with direct lagoon access stairs into turquoise sea',
      'Private overwater sundeck with sun loungers and glass floor viewing panels',
      'All-Inclusive gourmet dining with multi-cuisine international buffets and premium drinks',
      'Romantic 4-course candlelit dinner on the beach under the stars for couples',
      'Complimentary non-motorized water sports (stand-up paddleboarding, sea kayaking)',
    ],
    full_description: `Live your ultimate dream holiday with Travinco’s ultra-luxurious 5-Day Maldives Overwater Villa Escape. Designed specifically for honeymooners, anniversary celebrations, and luxury seekers, this all-inclusive resort package brings you the quintessential Maldivian experience of staying perched above the sparkling turquoise lagoon.

Wake up in your spacious Overwater Villa to panoramic ocean views from your king-size bed. Step straight from your private wooden sun deck into warm, crystal-clear lagoon waters teeming with colorful reef fish, baby reef sharks, and eagle rays. 

Indulge in world-class all-inclusive dining with culinary creations from internationally acclaimed chefs, tropical cocktails, and beachside sunset grills. Enjoy complimentary sea kayaking across the calm house reef, a rejuvenating couple's spa treatment, and a magical private four-course candlelit dinner set right on the white coral sand under the starlit sky.`,
    meta_title: 'Maldives Luxury Overwater Villa Package 5 Days | Travinco',
    meta_description: 'Book 5-day luxury Maldives Overwater Villa package. All-inclusive meals, private ocean deck, candlelit beach dinner, and airport transfers.',
    inclusions: [
      '4 Nights stay in a luxury Overwater Villa with direct ocean lagoon access',
      'All-Inclusive meal plan (Breakfast, Lunch, Dinner and afternoon snacks)',
      'Unlimited selection of premium beverages, mocktails, and cocktails during dining hours',
      'Round-trip airport transfers from Velana International Airport (Malé)',
      'One romantic 4-course candlelit beach dinner with wine for couples',
      'Complimentary use of snorkeling equipment, sea kayaks, and stand-up paddle boards',
      'All Maldives Green Taxes, service fees, and local tourism levies included',
    ],
    exclusions: [
      'International flights to/from Malé (MLE)',
      'Motorized water sports (jet ski, flyboard, seabed seabob)',
      'Overwater spa treatments and personalized massage therapies',
      'Optional underwater restaurant dining or diving excursions',
    ],
    itinerary: [
      {
        day_number: 1,
        title: 'Arrival in Malé & Overwater Villa Welcome',
        description: 'Arrive at Velana International Airport in Malé. Meet your resort host and transfer across the turquoise sea to your private 5-star island resort. Check into your breathtaking Overwater Villa. Toast with champagne on your private sundeck and watch the sunset illuminate the lagoon.',
        hotel: 'Luxury Overwater Villa with Lagoon Access',
        meals: 'All-Inclusive Dinner',
        transport: 'Speedboat / Seaplane Transfer',
      },
      {
        day_number: 2,
        title: 'Overwater Living & House Reef Snorkeling',
        description: 'Enjoy a gourmet breakfast overlooking the ocean. Step directly down from your villa stairs for a swim in the turquoise water. In the afternoon, explore the resort’s vibrant house reef with complimentary snorkeling gear, spotting reef sharks, moray eels, and vibrant coral formations.',
        hotel: 'Luxury Overwater Villa with Lagoon Access',
        meals: 'All-Inclusive (Breakfast, Lunch, Dinner)',
        transport: 'Resort stay',
      },
      {
        day_number: 3,
        title: 'Lagoon Kayaking & Romantic Beachside Candlelight Dinner',
        description: 'Morning paddleboarding or double-kayaking across the calm sheltered lagoon waters. In the evening, savor a private four-course candlelit dinner prepared right on the white sand beach with torchlights and the sound of gentle waves lapping at the shore.',
        hotel: 'Luxury Overwater Villa with Lagoon Access',
        meals: 'All-Inclusive (Breakfast, Lunch, Romantic Dinner)',
        transport: 'Resort stay',
      },
      {
        day_number: 4,
        title: 'Leisure, Overwater Spa & Sunset Cocktails',
        description: 'A day of pure tropical indulgence. Relax on the sundeck, indulge in an optional holistic Ayurvedic or Balinese massage at the overwater spa with glass floor treatment rooms, and sip signature tropical cocktails as the sun sinks below the horizon.',
        hotel: 'Luxury Overwater Villa with Lagoon Access',
        meals: 'All-Inclusive (Breakfast, Lunch, Dinner)',
        transport: 'Resort stay',
      },
      {
        day_number: 5,
        title: 'Morning Lagoon Swim & Departure',
        description: 'Enjoy your final sunrise swim from your overwater deck, followed by an expansive breakfast buffet. Check out and take the scenic transfer back to Malé Airport for your flight home, with sun-kissed memories to cherish forever.',
        hotel: 'Check out',
        meals: 'Breakfast',
        transport: 'Speedboat / Seaplane Transfer to Malé Airport',
      },
    ],
    faqs: [
      {
        question: 'Are children allowed to stay in Overwater Villas?',
        answer: 'Most Maldivian resorts permit children in overwater villas upon signing a standard parental safety disclaimer, though beachfront villas are often recommended for families with very young toddlers.',
      },
      {
        question: 'What is included in the All-Inclusive meal plan?',
        answer: 'The plan includes daily breakfast, lunch, and dinner at the main buffet and designated dining outlets, along with select non-alcoholic and alcoholic beverages throughout the day.',
      },
      {
        question: 'Can we upgrade to a villa with a private plunge pool on the deck?',
        answer: 'Yes, Overwater Pool Villas with private infinity plunge pools can be arranged upon request based on seasonal availability.',
      },
    ],
  },
  {
    id: 'b1856890-7c18-4616-83c2-194d0c65d2c1',
    title: 'Ooty & Coonoor Nilgiri Hills Heritage Journey',
    child_price: 6500,
    pickup_info: 'Pickup & drop from Coimbatore International Airport (CJB) or Coimbatore Junction',
    highlights: [
      'Ride the historic UNESCO World Heritage Nilgiri Mountain Toy Train between Ooty and Coonoor',
      'Panoramic 360-degree vistas of the Blue Mountains from Doddabetta Peak (highest in Nilgiris)',
      'Explore the lush 55-acre Government Botanical Gardens and fragrant Rose Garden',
      'Stroll through manicured tea estates and viewpoints at Dolphin’s Nose and Sim’s Park in Coonoor',
      'Pedal boating on Ooty Lake and sampling authentic handmade Nilgiri chocolates',
    ],
    full_description: `Experience the colonial charm and emerald grandeur of the Blue Mountains with Travinco’s 3-Day Ooty & Coonoor Nilgiri Hills Heritage Journey. Established during the British Raj as the premier hill station of the Madras Presidency, Ooty (Udhagamandalam) and its sister town Coonoor boast cool alpine air, sweeping tea plantations, and heritage train journeys.

Your journey ascends from Coimbatore through the verdant Nilgiri foothills. Ride the historic steam-assisted Nilgiri Mountain Railway—a UNESCO World Heritage site—winding through bridges, dark tunnels, and cliffside tea terraces.

Stand atop Doddabetta Peak (2,637 m), the highest point in the Nilgiri hills, to gaze upon the meeting point of the Western and Eastern Ghats. Walk amongst rare exotic orchids and fossilized tree trunks at the Government Botanical Garden, cruise on the peaceful waters of Ooty Lake, and visit Dolphin's Nose viewpoint in Coonoor for dramatic views of Catherine Falls plunging into the deep ravines below.`,
    meta_title: 'Ooty & Coonoor 3 Days Heritage Tour Package | Travinco',
    meta_description: 'Book 3-day Ooty and Coonoor tour package with Nilgiri Toy Train, Doddabetta Peak, botanical gardens, tea factory visit, and private cab from Coimbatore.',
    inclusions: [
      '2 Nights stay in a colonial heritage hotel / luxury resort in Ooty',
      'Daily breakfast and dinner at the hotel',
      'All sightseeing and transfers in a dedicated private AC vehicle',
      'Nilgiri Mountain Toy Train tickets (Ooty to Coonoor - subject to railway allotment)',
      'All interstate road taxes, toll plaza charges, parking fees, and driver allowances',
      'Entry tickets to Government Botanical Garden and Rose Garden',
    ],
    exclusions: [
      'Train / flight tickets to/from Coimbatore',
      'Lunches, snacks, and personal beverages',
      'Boating fees at Ooty Lake and optional horse riding',
      'Camera and video recording fees at tourist parks',
    ],
    itinerary: [
      {
        day_number: 1,
        title: 'Arrival in Coimbatore & Scenic Drive to Ooty',
        description: 'Meet your chauffeur at Coimbatore Airport/Railway Station. Embark on a picturesque 3-hour hill drive ascending through tea estates and eucalyptus groves. Check in at your colonial heritage hotel. In the afternoon, visit the 55-acre Government Botanical Garden and enjoy an evening boat ride on Ooty Lake. Visit local markets for handmade dark chocolates.',
        hotel: 'Savoy - IHCL SeleQtions / Gem Park Ooty or similar',
        meals: 'Dinner',
        transport: 'Private AC vehicle',
      },
      {
        day_number: 2,
        title: 'UNESCO Toy Train to Coonoor, Dolphin’s Nose & Tea Factory',
        description: 'After breakfast, board the historic Nilgiri Mountain Toy Train from Ooty to Coonoor. Savor the vintage journey through mountain tunnels and tea terraces. Meet your cab in Coonoor and visit Sim’s Park, Lamb’s Rock, and Dolphin’s Nose viewpoint overlooking Catherine Falls. Tour an active tea factory to observe orthodox tea manufacturing before returning to Ooty.',
        hotel: 'Savoy - IHCL SeleQtions / Gem Park Ooty or similar',
        meals: 'Breakfast & Dinner',
        transport: 'Nilgiri Toy Train + Private AC vehicle',
      },
      {
        day_number: 3,
        title: 'Doddabetta Peak, Pykara Lake & Return to Coimbatore',
        description: 'After breakfast, drive up to Doddabetta Peak, the highest summit in the Nilgiri range, for sweeping 360-degree views of the valleys. Next, take a short drive to the serene Pykara Lake and waterfalls nestled in pine woodlands. In the afternoon, descend to Coimbatore for your onward flight or train.',
        hotel: 'Check out',
        meals: 'Breakfast',
        transport: 'Private AC vehicle transfer to Coimbatore',
      },
    ],
    faqs: [
      {
        question: 'Are Nilgiri Toy Train tickets guaranteed?',
        answer: 'Toy train tickets are in high demand and subject to Indian Railways availability. We book tickets well in advance; in the rare case of railway cancellation or non-allotment, the Ooty-Coonoor transfer is conducted seamlessly by private cab with equal scenic viewpoints.',
      },
      {
        question: 'What is the closest airport to Ooty?',
        answer: 'Coimbatore International Airport (CJB) is the closest airport, located about 88 km (approx. 3 hours drive) from Ooty.',
      },
      {
        question: 'What clothes should we pack for Ooty?',
        answer: 'Warm woolens, sweaters, and jackets are essential throughout the year, especially for cool evenings and misty mornings when temperatures often drop below 12°C.',
      },
    ],
  },
];

async function run() {
  console.log('Logging in as super_admin...');
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'travinco2026@gmail.com',
    password: 'TestPassword123!',
  });

  if (authError || !auth.user) {
    console.error('Failed to log in:', authError);
    process.exit(1);
  }

  console.log('Logged in as:', auth.user.email);

  for (const pkg of packagesData) {
    console.log(`\n========================================`);
    console.log(`Updating Package: ${pkg.title} (ID: ${pkg.id})`);
    console.log(`========================================`);

    // 1. Update basic package fields
    const { error: pkgError } = await supabase
      .from('travel_packages')
      .update({
        title: pkg.title,
        full_description: pkg.full_description,
        highlights: pkg.highlights,
        child_price: pkg.child_price,
        pickup_info: pkg.pickup_info,
        meta_title: pkg.meta_title,
        meta_description: pkg.meta_description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pkg.id);

    if (pkgError) {
      console.error(`Error updating package info for ${pkg.title}:`, pkgError);
    } else {
      console.log(`✓ Updated main package fields (full_description, highlights, child_price, pickup_info, SEO).`);
    }

    // 2. Inclusions
    await supabase.from('package_inclusions').delete().eq('package_id', pkg.id);
    const inclusionsRows = pkg.inclusions.map((item, idx) => ({
      package_id: pkg.id,
      item,
      sort_order: idx + 1,
    }));
    const { error: incError } = await supabase.from('package_inclusions').insert(inclusionsRows);
    if (incError) console.error(`Error inserting inclusions for ${pkg.title}:`, incError);
    else console.log(`✓ Inserted ${inclusionsRows.length} inclusions.`);

    // 3. Exclusions
    await supabase.from('package_exclusions').delete().eq('package_id', pkg.id);
    const exclusionsRows = pkg.exclusions.map((item, idx) => ({
      package_id: pkg.id,
      item,
      sort_order: idx + 1,
    }));
    const { error: excError } = await supabase.from('package_exclusions').insert(exclusionsRows);
    if (excError) console.error(`Error inserting exclusions for ${pkg.title}:`, excError);
    else console.log(`✓ Inserted ${exclusionsRows.length} exclusions.`);

    // 4. Itinerary
    await supabase.from('package_itineraries').delete().eq('package_id', pkg.id);
    const itineraryRows = pkg.itinerary.map((d) => ({
      package_id: pkg.id,
      day_number: d.day_number,
      title: d.title,
      description: d.description,
      hotel: d.hotel,
      meals: d.meals,
      transport: d.transport,
    }));
    const { error: itiError } = await supabase.from('package_itineraries').insert(itineraryRows);
    if (itiError) console.error(`Error inserting itineraries for ${pkg.title}:`, itiError);
    else console.log(`✓ Inserted ${itineraryRows.length} itinerary days.`);

    // 5. FAQs
    await supabase.from('package_faqs').delete().eq('package_id', pkg.id);
    const faqRows = pkg.faqs.map((f, idx) => ({
      package_id: pkg.id,
      question: f.question,
      answer: f.answer,
      sort_order: idx + 1,
    }));
    const { error: faqError } = await supabase.from('package_faqs').insert(faqRows);
    if (faqError) console.error(`Error inserting FAQs for ${pkg.title}:`, faqError);
    else console.log(`✓ Inserted ${faqRows.length} FAQs.`);
  }

  console.log('\nAll 9 active packages have been successfully updated with full details!');
}

run().catch(console.error);
