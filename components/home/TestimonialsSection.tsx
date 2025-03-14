"use client";

import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Testimonial {
  id: number;
  name: string;
  role: string;
  avatar: string;
  comment: string;
  rating: number;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "FPL Philips",
    role: "Content Creator",
    avatar: "/avatars/philips.jpg",
    comment: "I can't go a Gameweek without using Fantasy Football Fix to help with my transfers.",
    rating: 5
  },
  {
    id: 2,
    name: "Colm Hayes",
    role: "FPL News",
    avatar: "/avatars/colm.jpg",
    comment: "Fix is a stat-lover's heaven. The Rotation Planner is an extremely handy preseason tool and I love the live heatmaps feature.",
    rating: 5
  },
  {
    id: 3,
    name: "Tom Campbell",
    role: "Fix Premium member since 2018",
    avatar: "/avatars/tom.jpg",
    comment: "Fix's tools and content have really improved my strategies and planning.",
    rating: 5
  },
  {
    id: 4,
    name: "Sarah Johnson",
    role: "Elite FPL Manager",
    avatar: "/avatars/sarah.jpg",
    comment: "The statistical analysis and prediction tools have transformed my decision-making process.",
    rating: 5
  }
];

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
    }, 5000); // Change testimonial every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="py-12">
      <div>
        <h2 className="text-3xl font-bold text-center mb-8">
          Loved by the world's best FPL managers
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Don't just take our word for it. We've helped thousands of managers improve their
          overall ranks and dominate mini-leagues.
        </p>
        
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {testimonials.map((testimonial) => (
                  <div
                    key={testimonial.id}
                    className="w-full flex-shrink-0 px-2 sm:px-4"
                  >
                    <Card className="p-4 sm:p-6 md:p-8">
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                        <Avatar className="w-16 h-16 sm:w-12 sm:h-12">
                          <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                          <AvatarFallback>{testimonial.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row items-center sm:items-start sm:justify-between gap-2 sm:gap-0 mb-4 sm:mb-2">
                            <div>
                              <h3 className="font-semibold text-center sm:text-left">{testimonial.name}</h3>
                              <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                            </div>
                            <div className="flex gap-1">
                              {[...Array(testimonial.rating)].map((_, i) => (
                                <svg
                                  key={i}
                                  className="w-5 h-5 text-yellow-400"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          </div>
                          <p className="text-base sm:text-lg text-center sm:text-left">{testimonial.comment}</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-center mt-6 gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-primary' : 'bg-primary/20'
                  }`}
                  onClick={() => setCurrentIndex(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}