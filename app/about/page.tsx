import { Card, CardContent } from "@/components/ui/card";
import { Heart, Users, Award, Coffee } from "lucide-react";
import {
  getStaticSection,
  getOpeningHours,
  getAllSiteSettings,
} from "@/lib/queries";
import SupabaseImage from "@/components/SupabaseImage";
import { convert24To12 } from "@/lib/utils/timezone";

// Production-ready ISR: Revalidate every 1 hour (3600 seconds) - mostly static content
// Served from cache; updates only when content changes
export const revalidate = 3600;

export default async function AboutPage() {
  const aboutSection = await getStaticSection("about");
  const openingHours = await getOpeningHours();
  const siteSettings = await getAllSiteSettings();

  const locationInfo = {
    address: siteSettings.restaurant_address || siteSettings.address || "",
    phone: siteSettings.restaurant_phone || siteSettings.phone || "",
    email: siteSettings.restaurant_email || siteSettings.email || "",
  };

  return (
    <div className="section-bg-primary section-spacing">
      <div className="container-global">
        <div className="text-center mb-12 md:mb-16">
          <h1 className="section-title mb-4 text-gradient-amber">ABOUT-US</h1>
          <div className="section-divider-enhanced mb-6"></div>
          <p className="body-text max-w-3xl mx-auto text-lg opacity-90">
            Learn more about Good Times Bar & Grill and what makes us special.
          </p>
        </div>

        {/* Main Story */}
        <div className="max-w-4xl mx-auto mb-12 md:mb-16 lg:mb-20">
          <div className="card-premium">
            {/* Title */}
            <div className="mb-4 md:mb-6">
              <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-3 md:mb-4 leading-tight">
                {aboutSection?.title || "OUR STORY"}
              </h2>
              <div className="w-20 md:w-24 h-0.5 md:h-1 bg-[#F59E0B] rounded-full"></div>
            </div>

            {/* Content */}
            <div className="prose prose-lg max-w-none">
              {aboutSection?.body ? (
                <div
                  className="body-text text-sm md:text-base lg:text-lg leading-relaxed space-y-3 md:space-y-4 text-[#D1D5DB]"
                  dangerouslySetInnerHTML={{
                    __html: aboutSection.body
                      .replace(/\n\n+/g, '</p><p class="mb-3 md:mb-4">')
                      .replace(/\n/g, "<br />")
                      .replace(/^/, '<p class="mb-3 md:mb-4">')
                      .replace(/$/, "</p>"),
                  }}
                />
              ) : (
                <div className="body-text text-sm md:text-base lg:text-lg leading-relaxed space-y-3 md:space-y-4 text-[#D1D5DB]">
                  <p className="text-base md:text-lg lg:text-xl leading-relaxed text-white/90 font-light mb-3 md:mb-4">
                    Good Times Bar and Grill is your destination for great food,
                    awesome drinks, live music and more!
                    {locationInfo.address &&
                      ` We are located at ${locationInfo.address} and are open daily for happy hour, and dinner.`}
                  </p>
                  <p className="leading-relaxed mb-3 md:mb-4">
                    Since opening our doors, we've been committed to providing
                    an exceptional dining experience combined with live
                    entertainment that creates unforgettable memories. Our
                    passion for quality food, craft beverages, and vibrant
                    atmosphere has made us a beloved gathering place in the
                    community.
                  </p>
                  <p className="leading-relaxed">
                    Whether you're joining us for a casual meal, celebrating a
                    special occasion, or enjoying one of our live music events,
                    we're here to ensure you have a great time.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8 mb-12 md:mb-16 lg:mb-20">
          <div className="card-premium text-center group hover:border-[#F59E0B]/50 p-4 md:p-6">
            <div className="mb-4 md:mb-6 flex justify-center">
              <div className="bg-[#F59E0B]/10 rounded-2xl w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 flex items-center justify-center group-hover:bg-[#F59E0B]/20 transition-colors border border-[#F59E0B]/20">
                <Heart className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-[#F59E0B]" />
              </div>
            </div>
            <h3 className="card-title mb-2 md:mb-3 text-[#F59E0B] text-base md:text-lg">
              PASSION
            </h3>
            <p className="body-text text-xs md:text-sm">
              We're passionate about creating amazing experiences for our
              guests.
            </p>
          </div>

          <div className="card-premium text-center group hover:border-[#F59E0B]/50 p-4 md:p-6">
            <div className="mb-4 md:mb-6 flex justify-center">
              <div className="bg-[#F59E0B]/10 rounded-2xl w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 flex items-center justify-center group-hover:bg-[#F59E0B]/20 transition-colors border border-[#F59E0B]/20">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-[#F59E0B]" />
              </div>
            </div>
            <h3 className="card-title mb-2 md:mb-3 text-[#F59E0B] text-base md:text-lg">
              COMMUNITY
            </h3>
            <p className="body-text text-xs md:text-sm">
              Building connections and bringing people together through food and
              music.
            </p>
          </div>

          <div className="card-premium text-center group hover:border-[#F59E0B]/50 p-4 md:p-6">
            <div className="mb-4 md:mb-6 flex justify-center">
              <div className="bg-[#F59E0B]/10 rounded-2xl w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 flex items-center justify-center group-hover:bg-[#F59E0B]/20 transition-colors border border-[#F59E0B]/20">
                <Award className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-[#F59E0B]" />
              </div>
            </div>
            <h3 className="card-title mb-2 md:mb-3 text-[#F59E0B] text-base md:text-lg">
              QUALITY
            </h3>
            <p className="body-text text-xs md:text-sm">
              Using the finest ingredients and maintaining the highest
              standards.
            </p>
          </div>

          <div className="card-premium text-center group hover:border-[#F59E0B]/50 p-4 md:p-6">
            <div className="mb-4 md:mb-6 flex justify-center">
              <div className="bg-[#F59E0B]/10 rounded-2xl w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 flex items-center justify-center group-hover:bg-[#F59E0B]/20 transition-colors border border-[#F59E0B]/20">
                <Coffee className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-[#F59E0B]" />
              </div>
            </div>
            <h3 className="card-title mb-2 md:mb-3 text-[#F59E0B] text-base md:text-lg">
              EXPERIENCE
            </h3>
            <p className="body-text text-xs md:text-sm">
              Creating memorable moments that keep you coming back.
            </p>
          </div>
        </div>

        {/* Location & Hours */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
          <div className="card-premium">
            <h2 className="card-title mb-4 md:mb-6 text-[#F59E0B] text-lg md:text-xl">
              LOCATION
            </h2>
            <div className="space-y-4 md:space-y-5">
              <div>
                <p className="font-semibold body-text mb-2 text-sm md:text-base">
                  Address
                </p>
                <p className="body-text opacity-80 text-sm md:text-base">
                  {locationInfo.address}
                </p>
              </div>
              <div>
                <p className="font-semibold body-text mb-2 text-sm md:text-base">
                  Phone
                </p>
                <a
                  href={`tel:${locationInfo.phone.replace(/\D/g, "")}`}
                  className="price-amber hover:text-[#D97706] transition-colors text-sm md:text-base"
                >
                  {locationInfo.phone}
                </a>
              </div>
              <div>
                <p className="font-semibold body-text mb-2 text-sm md:text-base">
                  Email
                </p>
                <a
                  href={`mailto:${locationInfo.email}`}
                  className="price-amber hover:text-[#D97706] transition-colors text-sm md:text-base break-all"
                >
                  {locationInfo.email}
                </a>
              </div>
            </div>
          </div>

          <div className="card-premium">
            <h2 className="card-title mb-4 md:mb-6 text-[#F59E0B] text-lg md:text-xl">
              OPENING HOURS
            </h2>
            <div className="space-y-3 md:space-y-4">
              {(() => {
                const dayNames = [
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ];
                // Create a map of weekday to hours for quick lookup
                const hoursMap = new Map();
                openingHours.forEach((hours) => {
                  hoursMap.set(hours.weekday, hours);
                });

                // Display all 7 days, using database data if available
                return dayNames.map((dayName, index) => {
                  const hours = hoursMap.get(index);
                  if (!hours || hours.is_closed) {
                    return (
                      <div
                        key={index}
                        className="flex justify-between items-center pb-2 md:pb-3 border-b border-white/10 last:border-b-0"
                      >
                        <span className="font-medium body-text text-sm md:text-base">
                          {dayName}
                        </span>
                        <span className="body-text opacity-60 text-sm md:text-base">
                          Closed
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={index}
                      className="flex justify-between items-center pb-2 md:pb-3 border-b border-white/10 last:border-b-0"
                    >
                      <span className="font-medium body-text text-sm md:text-base">
                        {dayName}
                      </span>
                      <span className="body-text opacity-80 text-sm md:text-base">
                        {hours.open_time && hours.close_time
                          ? `${convert24To12(
                              hours.open_time
                            )} - ${convert24To12(hours.close_time)}`
                          : "Closed"}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
