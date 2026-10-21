const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey);

const newBlogPosts = [
  {
    title: "Top 7 Secret Houseboat Routes in Kerala's Backwaters",
    slug: 'top-secret-houseboat-routes-kerala-backwaters',
    excerpt: "Beyond the crowded canals of central Alleppey lie quiet palm-fringed lagoons, secluded village shores, and tranquil waterways where traditional kettuvallams glide under amber sunsets.",
    cover_image_url: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80',
    status: 'published',
    content: `Top 7 Secret Houseboat Routes in Kerala's Backwaters

For decades, the backwaters of Kerala have represented the pinnacle of serene, slow-paced luxury travel. Floating silently aboard a handcrafted Kettuvallam (traditional thatched houseboat), travelers are treated to an ever-unfolding canvas of coconut groves, emerald paddy fields, and timeless village life. However, while the main channels of Alleppey (Alappuzha) can occasionally see heavy boat traffic during peak tourist months, experienced navigators know that the real magic lies tucked away in the quieter tributary canals and lesser-known lagoons.

Here are the top secluded backwater routes curated by Travinco's local route specialists for an authentic, unforgettable voyage.

1. The Kumarakom to Alappuzha Crossing across Vembanad Lake

Starting from the bird-rich shores of Kumarakom, this route opens wide into the vast expanse of Vembanad Lake, India's longest lake. As you cross the open waters in the golden morning light, flocks of migratory cormorants, kingfishers, and herons skim the surface. The transition from wide open horizon into the narrow canals of Kainakary provides a dramatic contrast of scale and intimacy.

2. The Heritage Canal of Kavalam and Champakulam

Lined with centuries-old Syrian Christian churches and aristocratic ancestral homesteads (Tharavads), the Champakulam route is steeped in Kerala maritime lore. Champakulam is famous for housing the historic snake boats (Chundan Vallams) that compete in the electrifying Nehru Trophy Boat Race. Gliding past local carpenters at work and mooring beside water lily shallows at twilight is an ethereal experience.

3. The Island Splendor of Munroe Island & Kollam

Located south of Alleppey near the historic port town of Kollam, the Ashtamudi Lake and Munroe Island network remains delightfully off the mainstream tourist radar. The canals here are spanned by low wooden footbridges, and the water is so crystal clear you can watch shoals of pearl spot (Karimeen) darting between mangrove roots. Travinco organizes private canoe excursions branching directly off your houseboat anchor point.

4. Culinary Highlights on the Water

A key part of every Travinco luxury houseboat voyage is the dedicated onboard chef. Savor freshly prepared Kuttanadan fish curry simmered in fragrant coconut milk and cocum, flaky Kerala parottas, steamed appams, tender banana roast, and freshly caught Tiger prawns seared with crushed black pepper. All meals are prepared live to your personal spice preferences.

Best Time to Embark:

The post-monsoon and winter months between October and March offer cool breezes, crystal blue skies, and blooming pink water lilies. Monsoons (June to August) are equally enchanting for romantic getaways when rain patterns dance across the lagoon waters.

Ready to book your private Kerala houseboat escape? Contact Travinco's holiday specialists to customize your private cruise itinerary.`,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    is_deleted: false,
  },
  {
    title: "First-Timer's Guide to Bali: Temples, Waterfalls, and Hidden Beaches",
    slug: 'first-timers-guide-to-bali-temples-waterfalls-beaches',
    excerpt: "From sunrise over Mount Batur to the emerald cascade of Tukad Cepung and Uluwatu's dramatic clifftop temples, here is everything you need to craft your maiden voyage to the Island of the Gods.",
    cover_image_url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80',
    status: 'published',
    content: `First-Timer's Guide to Bali: Temples, Waterfalls, and Hidden Beaches

With its deeply spiritual culture, dramatic volcanic landscapes, terraced rice paddies, and sun-drenched coastline, Bali is consistently ranked among the world's premier holiday destinations. Whether you are seeking holistic wellness in the jungle, world-class cafe hopping, or thrilling underwater adventures, Bali offers a rich tapestry of experiences for every style of traveler.

To help first-time visitors maximize their time, our Travinco international tour desk has assembled this essential guide covering key regions, must-visit sights, and practical tips.

1. Ubud: The Spiritual and Cultural Heart

Nestled among the central highlands, Ubud is Bali's capital of arts, wellness, and rainforest serenity. Start your morning walking the lush ridges of the Campuhan Ridge Trail before the tropical heat builds up. Spend afternoons marveling at the tiered green amphitheaters of the Tegalalang Rice Terraces, and discover hidden waterfalls like Tukad Cepung, where sunlight pierces through a subterranean cavern ceiling.

2. Uluwatu and the Bukit Peninsula: Clifftop Drama

For dramatic ocean views, head south to Uluwatu. Perched 70 meters above crashing surf on a limestone cliff, Pura Luhur Uluwatu is one of Bali's six key spiritual pillars. Arrive in the late afternoon to secure seats for the iconic Kecak Fire Dance, which unfolds against the backdrop of a flaming crimson sunset over the Indian Ocean. Follow up with a candlelit fresh seafood dinner directly on the sands of Jimbaran Bay.

3. Island Day Trip: Nusa Penida

Just a 45-minute speedboat ride from Sanur harbor lies Nusa Penida. The island's signature T-Rex shaped cliff at Kelingking Beach, the natural infinity pool of Angel's Billabong, and the pristine sands of Crystal Bay offer jaw-dropping photography opportunities and some of the best manta ray snorkeling in Southeast Asia.

Essential Travel Tips for Indian Travelers:

• Visa on Arrival: Indian passport holders can conveniently obtain a 30-day Visa on Arrival (VoA) online (e-VoA) or upon landing at Ngurah Rai International Airport in Denpasar.
• Currency: Indonesian Rupiah (IDR). Most cafes and beach clubs accept credit cards, but having cash on hand for local markets and temple donations is recommended.
• Temple Etiquette: Both men and women must wear a sarong and sash when entering holy temple compounds (these can be rented or purchased at temple entrances).
• Best Season: April to October brings dry sunny weather and comfortable humidity, perfect for exploring both coast and mountain trails.

Let Travinco handle your airport transfers, private chauffeured day tours, and luxury villa reservations for a seamless Indonesian holiday.`,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days ago
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    is_deleted: false,
  },
  {
    title: "Chasing the Northern Lights: How to Plan the Ultimate Scandinavian Winter Safari",
    slug: 'chasing-northern-lights-scandinavian-winter-safari',
    excerpt: "Witnessing the ethereal green dance of the Aurora Borealis is on every traveler's bucket list. Here is our insider guide to timing, glass igloos, husky sledding, and sub-zero packing essentials in Tromsø and Rovaniemi.",
    cover_image_url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1200&q=80',
    status: 'published',
    content: `Chasing the Northern Lights: How to Plan the Ultimate Scandinavian Winter Safari

Few natural spectacles on Earth evoke the wonder of the Aurora Borealis. Watching ribbon-like curtains of neon green, violet, and deep magenta swirl silently across an Arctic polar night is an experience that stays etched in the heart forever.

Planning a successful Northern Lights journey requires meticulous preparation, astronomical awareness, and local meteorological expertise. Here is how Travinco crafts the dream winter Arctic safari.

1. Choosing Your Arctic Base: Norway vs Finland

• Tromsø, Norway: Known as the "Gateway to the Arctic," Tromsø sits right in the center of the Northern Lights oval. Warm Gulf Stream currents keep temperatures comparatively milder than continental Lapland. The dramatic fjords framing snow-covered peaks make every chase visually spectacular.
• Rovaniemi & Finnish Lapland: The official hometown of Santa Claus, Rovaniemi is ideal for families and travelers seeking storybook winter wonderland magic. Staying in a heated glass-roofed igloo allows you to drift to sleep gazing up directly into the starry polar cosmos.

2. Iconic Arctic Adventures Beyond the Lights

An Arctic expedition is much more than just night watching. Daytime in the Arctic reveals thrilling adventures:
• Husky Dog Sledding: Drive your own team of eager Alaskan and Siberian huskies through snow-draped pine forests.
• Reindeer Sleigh Rides: Experience ancient Sámi nomadic culture, learn traditional reindeer herding traditions, and warm yourself by an open fire inside a traditional Lavvu tent.
• Snowmobiling across Frozen Fjords: Glide across boundless white wilderness trails and frozen lakes with expert polar wilderness guides.

3. Aurora Photography Secrets

To capture crisp aurora photographs with smartphones or DSLRs:
• Mount your device on a sturdy tripod—long exposures (3 to 10 seconds) will blur without stable support.
• Use manual mode: Set aperture to the lowest f-stop (f/1.8 to f/2.8), ISO around 1600–3200, and focus to manual infinity.
• Keep spare batteries in your inside coat pocket close to body heat; arctic cold drains lithium-ion batteries rapidly.

When to Visit:

The Arctic aurora season spans from late September through early April, with the darkest polar nights between November and February providing maximum viewing hours.

Travinco curates complete Scandinavian holiday packages including luxury glass igloo bookings, arctic winter thermal gear, airport transfers, and seasoned aurora guide escorts.`,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(), // 12 days ago
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    is_deleted: false,
  },
  {
    title: "Munnar in the Mist: A Connoisseur's Guide to Tea Estates and Cloud Walks",
    slug: 'munnar-in-the-mist-tea-estates-cloud-walks',
    excerpt: "Perched at 1,600 meters in the Western Ghats, Munnar captivates with endless manicured emerald tea slopes, endangered Nilgiri Tahr sightings, and boutique heritage bungalow stays.",
    cover_image_url: 'https://images.unsplash.com/photo-1506461883276-594a12b11cf3?auto=format&fit=crop&w=1200&q=80',
    status: 'published',
    content: `Munnar in the Mist: A Connoisseur's Guide to Tea Estates and Cloud Walks

Rising gracefully where three mountain streams converge—Mudrapuzha, Nallathanni, and Kundala—Munnar was once the favored summer resort of the British administration in South India. Today, its rolling hills blanketed in neatly manicured emerald tea bushes, cool alpine climate, and mist-veiled crags draw discerning nature enthusiasts and luxury seekers from across the globe.

Step off the beaten path with Travinco's guide to the finest heritage experiences Munnar has to offer.

1. Exploring Kolukkumalai: The World's Highest Tea Plantation

Perched at nearly 7,900 feet above sea level, Kolukkumalai produces orthodox teas using traditional artisan methods dating back to the 1930s. The thrilling jeep ride up rugged cliffside trails is rewarded by breathtaking 360-degree views across the Tamil Nadu plains and Kerala valleys. Tasting freshly brewed black tea right at the wooden vintage factory while clouds brush against your face is an unforgettable high.

2. Wildlife Encounters in Eravikulam National Park

Home to the largest surviving population of the endangered Nilgiri Tahr (mountain goat), Eravikulam National Park offers gentle walking trails through high-altitude shola-grassland ecosystems. The park is also famous for the legendary Neelakurinji flower, which blossoms once every twelve years, turning the entire hillsides into a breathtaking sea of violet-blue.

3. Historic Tea Estate Bungalow Living

For the quintessential Munnar experience, forgo generic hotels in favor of restored British colonial planter bungalows. Wake up to bird songs, stroll through private tea garden trails with in-house naturalists, enjoy high tea on manicured lawns, and cozy up beside real wood fireplaces as crisp mountain mist descends in the evening.

4. Mattupetty Dam & Kundala Lake

Take a tranquil speed boat or pedal boat ride across Mattupetty Dam reservoir, surrounded by dense eucalyptus and pine forests where wild elephant herds frequently come down to drink at the water's edge. Nearby Kundala Lake is renowned for its charming Shikara-style boats that evoke the romantic calm of Kashmir.

Best Seasons to Visit:

September to March offers glorious weather with temperatures hovering between 15°C and 25°C, ideal for trekking, plantation walks, and photography. April to June is perfect for escaping the sweltering plains.

Discover Travinco's signature Munnar wellness and luxury packages tailored with private transfers, plantation stays, and expert local guides.`,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(), // 18 days ago
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(),
    is_deleted: false,
  },
];

async function seed() {
  console.log('Signing in as admin user...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'travinco2026@gmail.com',
    password: 'TestPassword123!',
  });

  if (authError || !authData.user) {
    console.error('Sign-in failed:', authError);
    process.exit(1);
  }

  console.log('Signed in successfully as:', authData.user.email);
  const staffId = authData.user.id;

  for (const post of newBlogPosts) {
    console.log(`Inserting: "${post.title}"...`);
    const { data, error } = await supabase
      .from('blog_posts')
      .upsert(
        {
          ...post,
          created_by: staffId,
        },
        { onConflict: 'slug' }
      )
      .select('id, title, slug, status, created_at');

    if (error) {
      console.error(`Error inserting "${post.title}":`, error);
    } else {
      console.log(`Successfully added post ID: ${data[0].id} (slug: ${data[0].slug})`);
    }
  }

  console.log('\nAll 4 blog posts have been successfully added to the database!');
}

seed().catch(console.error);
