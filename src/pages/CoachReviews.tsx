import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star } from 'lucide-react';
import { toast } from 'sonner';

export default function CoachReviews() {
  const { currentUser } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadReviews();
  }, [currentUser]);

  const loadReviews = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('coach_reviews')
        .select(`
          *,
          profiles:player_id (full_name, avatar_url)
        `)
        .eq('coach_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const submitResponse = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from('coach_reviews')
        .update({ coach_response: responseText[reviewId] })
        .eq('id', reviewId);

      if (error) throw error;

      toast.success('Response submitted');
      setResponseText({ ...responseText, [reviewId]: '' });
      loadReviews();
    } catch (error) {
      console.error('Error submitting response:', error);
      toast.error('Failed to submit response');
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="p-6">Loading reviews...</div>;
  }

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
          Reviews & Ratings
        </h1>
        <p className="text-muted-foreground mt-2">
          See what your students are saying
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{averageRating}</div>
            <div className="mt-2">{renderStars(Number(averageRating))}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{reviews.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">5-Star Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {reviews.filter((r) => r.rating === 5).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Student Reviews</h2>
        {reviews.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No reviews yet</p>
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={review.profiles?.avatar_url} />
                      <AvatarFallback>
                        {review.profiles?.full_name?.split(' ').map((n: string) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{review.profiles?.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {renderStars(review.rating)}
                </div>

                {review.review_text && (
                  <p className="text-muted-foreground">{review.review_text}</p>
                )}

                {review.coach_response ? (
                  <div className="bg-accent p-4 rounded-lg">
                    <p className="text-sm font-semibold mb-2">Your Response:</p>
                    <p className="text-sm">{review.coach_response}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Write a response..."
                      value={responseText[review.id] || ''}
                      onChange={(e) =>
                        setResponseText({ ...responseText, [review.id]: e.target.value })
                      }
                      rows={3}
                    />
                    <Button
                      size="sm"
                      onClick={() => submitResponse(review.id)}
                      disabled={!responseText[review.id]}
                    >
                      Submit Response
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
